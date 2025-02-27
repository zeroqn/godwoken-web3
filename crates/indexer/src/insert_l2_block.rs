use std::{convert::TryFrom, str::FromStr};

use anyhow::Result;
use gw_types::U256;
use rust_decimal::Decimal;
use sqlx::{
    postgres::PgRow,
    types::{
        chrono::{DateTime, Utc},
        BigDecimal,
    },
    Row,
};
use sqlx::{Postgres, QueryBuilder};

use crate::types::{Block, Log, Transaction, TransactionWithLogs};

use itertools::Itertools;
use rayon::prelude::*;

const INSERT_LOGS_BATCH_SIZE: usize = 5000;

pub struct DbBlock<'a> {
    number: Decimal,
    hash: &'a [u8],
    parent_hash: &'a [u8],
    gas_limit: BigDecimal,
    gas_used: BigDecimal,
    timestamp: DateTime<Utc>,
    miner: &'a [u8],
    size: Decimal,
}

impl<'a> TryFrom<&'a Block> for DbBlock<'a> {
    type Error = anyhow::Error;

    fn try_from(block: &'a Block) -> Result<Self, Self::Error> {
        let a = Self {
            number: Decimal::from(block.number),
            hash: block.hash.as_slice(),
            parent_hash: block.parent_hash.as_slice(),
            gas_limit: u128_to_big_decimal(&block.gas_limit)?,
            gas_used: u128_to_big_decimal(&block.gas_used)?,
            timestamp: block.timestamp,
            miner: block.miner.as_ref(),
            size: Decimal::from(block.size),
        };
        Ok(a)
    }
}

#[derive(Debug, Clone)]
pub struct DbTransaction {
    hash: Vec<u8>,
    eth_tx_hash: Vec<u8>,
    block_number: Decimal,
    block_hash: Vec<u8>,
    transaction_index: Decimal,
    from_address: Vec<u8>,
    to_address: Option<Vec<u8>>,
    value: BigDecimal,
    nonce: Decimal,
    gas_limit: BigDecimal,
    gas_price: BigDecimal,
    input: Vec<u8>,
    v: Decimal,
    r: Vec<u8>,
    s: Vec<u8>,
    cumulative_gas_used: BigDecimal,
    gas_used: BigDecimal,
    contract_address: Option<Vec<u8>>,
    exit_code: Decimal,
}

impl TryFrom<Transaction> for DbTransaction {
    type Error = anyhow::Error;

    fn try_from(tx: Transaction) -> Result<DbTransaction, Self::Error> {
        let web3_to_address = tx.to_address.map(|addr| addr.to_vec());
        let web3_contract_address = tx.contract_address.map(|addr| addr.to_vec());
        let db_transaction = Self {
            hash: tx.gw_tx_hash.as_slice().to_vec(),
            eth_tx_hash: tx.compute_eth_tx_hash().as_slice().to_vec(),
            block_number: tx.block_number.into(),
            block_hash: tx.block_hash.as_slice().to_vec(),
            transaction_index: tx.transaction_index.into(),
            from_address: tx.from_address.to_vec(),
            to_address: web3_to_address,
            value: u256_to_big_decimal(&tx.value)?,
            nonce: tx.nonce.into(),
            gas_limit: u128_to_big_decimal(&tx.gas_limit)?,
            gas_price: u128_to_big_decimal(&tx.gas_price)?,
            input: tx.data,
            v: tx.v.into(),
            r: tx.r.to_vec(),
            s: tx.s.to_vec(),
            cumulative_gas_used: u128_to_big_decimal(&tx.cumulative_gas_used)?,
            gas_used: u128_to_big_decimal(&tx.gas_used)?,
            contract_address: web3_contract_address,
            exit_code: tx.exit_code.into(),
        };
        Ok(db_transaction)
    }
}

#[derive(Debug, Clone)]
pub struct DbLog {
    transaction_id: i64,
    transaction_hash: Vec<u8>,
    transaction_index: Decimal,
    block_number: Decimal,
    block_hash: Vec<u8>,
    address: Vec<u8>,
    data: Vec<u8>,
    log_index: Decimal,
    topics: Vec<Vec<u8>>,
}

impl DbLog {
    pub fn try_from_log(log: Log, transaction_id: i64) -> Result<DbLog> {
        let topics = log
            .topics
            .into_iter()
            .map(|t| t.as_slice().to_vec())
            .collect();

        let db_log = Self {
            transaction_id,
            transaction_hash: log.transaction_hash.as_slice().to_vec(),
            transaction_index: log.transaction_index.into(),
            block_number: log.block_number.into(),
            block_hash: log.block_hash.as_slice().to_vec(),
            address: log.address.to_vec(),
            data: log.data,
            log_index: log.log_index.into(),
            topics,
        };
        Ok(db_log)
    }
}

pub async fn insert_web3_block(
    web3_block: Block,
    pg_tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<()> {
    let block = DbBlock::try_from(&web3_block)?;

    sqlx::query(
        "INSERT INTO blocks (number, hash, parent_hash, gas_limit, gas_used, timestamp, miner, size) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
    )
        .bind(block.number)
        .bind(block.hash)
        .bind(block.parent_hash)
        .bind(block.gas_limit)
        .bind(block.gas_used)
        .bind(block.timestamp)
        .bind(block.miner)
        .bind(block.size)
        .execute(pg_tx)
        .await?;

    Ok(())
}

pub async fn insert_web3_txs_and_logs(
    web3_tx_with_logs_vec: Vec<TransactionWithLogs>,
    pg_tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<(usize, usize)> {
    if web3_tx_with_logs_vec.is_empty() {
        return Ok((0, 0));
    }

    let (txs, logs) = web3_tx_with_logs_vec
        .into_par_iter()
        .enumerate()
        .map(|(i, web3_tx_with_logs)| {
            // Set transaction_id to txs' index
            let db_logs: Result<Vec<DbLog>> = web3_tx_with_logs
                .logs
                .into_par_iter()
                .map(|l| DbLog::try_from_log(l, i as i64))
                .collect();
            (DbTransaction::try_from(web3_tx_with_logs.tx), db_logs)
        })
        .collect::<(Vec<_>, Vec<_>)>();
    let txs = txs.into_iter().collect::<Result<Vec<_>>>()?;
    let logs = logs.into_iter().collect::<Result<Vec<_>>>()?;
    let logs = logs.into_iter().flatten().collect::<Vec<_>>();

    let logs_len = logs.len();
    let txs_len = txs.len();

    let logs_slice = logs
        .into_iter()
        .chunks(INSERT_LOGS_BATCH_SIZE)
        .into_iter()
        .map(|chunk| chunk.collect())
        .collect::<Vec<Vec<_>>>();

    let mut txs_query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
                "INSERT INTO transactions
                (hash, eth_tx_hash, block_number, block_hash, transaction_index, from_address, to_address, value, nonce, gas_limit, gas_price, input, v, r, s, cumulative_gas_used, gas_used, contract_address, exit_code) "
            );

    txs_query_builder
        .push_values(txs, |mut b, tx| {
            b.push_bind(tx.hash)
                .push_bind(tx.eth_tx_hash)
                .push_bind(tx.block_number)
                .push_bind(tx.block_hash)
                .push_bind(tx.transaction_index)
                .push_bind(tx.from_address)
                .push_bind(tx.to_address)
                .push_bind(tx.value)
                .push_bind(tx.nonce)
                .push_bind(tx.gas_limit)
                .push_bind(tx.gas_price)
                .push_bind(tx.input)
                .push_bind(tx.v)
                .push_bind(tx.r)
                .push_bind(tx.s)
                .push_bind(tx.cumulative_gas_used)
                .push_bind(tx.gas_used)
                .push_bind(tx.contract_address)
                .push_bind(tx.exit_code);
        })
        .push(" RETURNING id");

    let mut tx_ids: Vec<i64> = vec![];

    let query = txs_query_builder.build();
    let rows: Vec<PgRow> = query.fetch_all(&mut (*pg_tx)).await?;
    let mut ids = rows
        .iter()
        .map(|r| r.get::<i64, _>("id"))
        .collect::<Vec<i64>>();
    tx_ids.append(&mut ids);

    let logs_querys = logs_slice
            .into_par_iter()
            .map(|db_logs| {
                let mut logs_query_builder: QueryBuilder<Postgres> = QueryBuilder::new(
                    "INSERT INTO logs
                    (transaction_id, transaction_hash, transaction_index, block_number, block_hash, address, data, log_index, topics)"
                );

                // Get transaction id from preview insert returning
                logs_query_builder.push_values(db_logs, |mut b, log| {
                    // transaction_id in log is transaction_id_index now
                    let transaction_id = tx_ids[log.transaction_id as usize];

                    b.push_bind(transaction_id)
                        .push_bind(log.transaction_hash)
                        .push_bind(log.transaction_index)
                        .push_bind(log.block_number)
                        .push_bind(log.block_hash)
                        .push_bind(log.address)
                        .push_bind(log.data)
                        .push_bind(log.log_index)
                        .push_bind(log.topics);
                });
                logs_query_builder
            }).collect::<Vec<_>>();

    if logs_len != 0 {
        for mut query_builder in logs_querys {
            let query = query_builder.build();
            query.execute(&mut (*pg_tx)).await?;
        }
    }

    Ok((txs_len, logs_len))
}

fn u128_to_big_decimal(value: &u128) -> Result<BigDecimal> {
    let result = BigDecimal::from_str(&value.to_string())?;
    Ok(result)
}

fn u256_to_big_decimal(value: &U256) -> Result<BigDecimal> {
    let result = BigDecimal::from_str(&value.to_string())?;
    Ok(result)
}
