import { RPC } from "ckb-js-toolkit";
import { RpcError } from "../error";
import { GW_RPC_REQUEST_ERROR } from "../error-code";
import { middleware } from "../validator";
import abiCoder, { AbiCoder } from "web3-eth-abi";
import {
  LogItem,
  PolyjuiceSystemLog,
} from "../types";

export class Gw {
  private rpc: RPC;
  constructor() {
    this.rpc = new RPC(process.env.GODWOKEN_JSON_RPC as string);

    this.ping = middleware(this.ping.bind(this), 0);
    this.get_tip_block_hash = middleware(this.get_tip_block_hash.bind(this), 0);
    this.get_block_hash = middleware(this.get_block_hash.bind(this), 0);
    this.get_block = middleware(this.get_block.bind(this), 0);
    this.get_block_by_number = middleware(
      this.get_block_by_number.bind(this),
      0
    );
    this.get_balance = middleware(this.get_balance.bind(this), 0);
    this.get_storage_at = middleware(this.get_storage_at.bind(this), 0);
    this.get_account_id_by_script_hash = middleware(
      this.get_account_id_by_script_hash.bind(this),
      0
    );
    this.get_nonce = middleware(this.get_nonce.bind(this), 0);
    this.get_script = middleware(this.get_script.bind(this), 0);
    this.get_script_hash = middleware(this.get_script_hash.bind(this), 0);
    this.get_data = middleware(this.get_data.bind(this), 0);
    this.get_transaction_receipt = middleware(
      this.get_transaction_receipt.bind(this),
      0
    );
    this.get_transaction = middleware(this.get_transaction.bind(this), 0);
    this.execute_l2transaction = middleware(
      this.execute_l2transaction.bind(this),
      0
    );
    this.execute_raw_l2transaction = middleware(
      this.execute_raw_l2transaction.bind(this),
      0
    );
    this.submit_l2transaction = middleware(
      this.submit_l2transaction.bind(this),
      0
    );
    this.submit_withdrawal_request = middleware(
      this.submit_withdrawal_request.bind(this),
      0
    );
  }

  async ping(args: any[]) {
    try {
      const result = await this.rpc.gw_ping(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_tip_block_hash(args: any[]) {
    try {
      const result = await this.rpc.gw_get_tip_block_hash(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_block_hash(args: any[]) {
    try {
      const result = await this.rpc.gw_get_block_hash(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_block(args: any[]) {
    try {
      const result = await this.rpc.gw_get_block(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_block_by_number(args: any[]) {
    try {
      const result = await this.rpc.gw_get_block_by_number(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_balance(args: any[]) {
    try {
      const result = await this.rpc.gw_get_balance(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_storage_at(args: any[]) {
    try {
      const result = await this.rpc.gw_get_storage_at(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_account_id_by_script_hash(args: any[]) {
    try {
      const result = await this.rpc.gw_get_account_id_by_script_hash(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_nonce(args: any[]) {
    try {
      const result = await this.rpc.gw_get_nonce(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_script(args: any[]) {
    try {
      const result = await this.rpc.gw_get_script(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_script_hash(args: any[]) {
    try {
      const result = await this.rpc.gw_get_script_hash(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_data(args: any[]) {
    try {
      const result = await this.rpc.gw_get_data(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_transaction_receipt(args: any[]) {
    try {
      const result = await this.rpc.gw_get_transaction_receipt(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_transaction(args: any[]) {
    try {
      const result = await this.rpc.gw_get_transaction(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async execute_l2transaction(args: any[]) {
    try {
      const result = await this.rpc.gw_execute_l2transaction(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async execute_raw_l2transaction(args: any[]) {
    try {
      const result = await this.rpc.gw_execute_raw_l2transaction(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async submit_l2transaction(args: any[]) {
    try {
      const result = await this.rpc.gw_submit_l2transaction(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async submit_withdrawal_request(args: any[]) {
    try {
      const result = await this.rpc.gw_submit_withdrawal_request(...args);
      return result;
    } catch (error) {
      parseError(error);
    }
  }

  async get_script_hash_by_short_address(args: any[]) {
    try {
      const result = await this.rpc.gw_get_script_hash_by_short_address(
        ...args
      );
      return result;
    } catch (error) {
      parseError(error);
    }
  }
}

function parsePolyjuiceSystemLog(logItem: LogItem): PolyjuiceSystemLog {
  let buf = Buffer.from(logItem.data.slice(2), "hex");
  if (buf.length !== 8 + 8 + 16 + 4 + 4) {
    throw new Error(`invalid system log raw data length: ${buf.length}`);
  }
  const gasUsed = buf.readBigUInt64LE(0);
  const cumulativeGasUsed = buf.readBigUInt64LE(8);
  const createdAddress = "0x" + buf.slice(16, 32).toString("hex");
  const statusCode = buf.readUInt32LE(32);
  return {
    gasUsed: gasUsed,
    cumulativeGasUsed: cumulativeGasUsed,
    createdAddress: createdAddress,
    statusCode: statusCode,
  };
}

function parseError(error: any): void {
  const prefix = "JSONRPCError: server error ";
  let message: string = error.message;
  if (message.startsWith(prefix)) {
    const jsonErr = message.slice(prefix.length);
    const err = JSON.parse(jsonErr);
    const polyjuiceSystemLog = parsePolyjuiceSystemLog(err.data.last_log);
    const abi = abiCoder as unknown;
    const statusReason = (abi as AbiCoder).decodeParameter("string", err.data.return_data.substring(10));
    const errorReceipt = {
        status_code: polyjuiceSystemLog.statusCode,
        status_reason: statusReason
    }
    throw new RpcError(err.code, JSON.stringify(errorReceipt));
  }

  // connection error
  if (message.startsWith("request to")) {
    throw new Error(message);
  }

  throw new RpcError(GW_RPC_REQUEST_ERROR, error.message);
}
