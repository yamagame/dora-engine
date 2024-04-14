/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "wave";

export interface WaveUnit {
  id: number;
  action: WaveUnit_Action;
  wave: Uint8Array;
}

export enum WaveUnit_Action {
  ACTION_UNKNOWN = 0,
  ACTION_BODY = 1,
  ACTION_CLOSE = 2,
  ACTION_RESET = 3,
  UNRECOGNIZED = -1,
}

export function waveUnit_ActionFromJSON(object: any): WaveUnit_Action {
  switch (object) {
    case 0:
    case "ACTION_UNKNOWN":
      return WaveUnit_Action.ACTION_UNKNOWN;
    case 1:
    case "ACTION_BODY":
      return WaveUnit_Action.ACTION_BODY;
    case 2:
    case "ACTION_CLOSE":
      return WaveUnit_Action.ACTION_CLOSE;
    case 3:
    case "ACTION_RESET":
      return WaveUnit_Action.ACTION_RESET;
    case -1:
    case "UNRECOGNIZED":
    default:
      return WaveUnit_Action.UNRECOGNIZED;
  }
}

export function waveUnit_ActionToJSON(object: WaveUnit_Action): string {
  switch (object) {
    case WaveUnit_Action.ACTION_UNKNOWN:
      return "ACTION_UNKNOWN";
    case WaveUnit_Action.ACTION_BODY:
      return "ACTION_BODY";
    case WaveUnit_Action.ACTION_CLOSE:
      return "ACTION_CLOSE";
    case WaveUnit_Action.ACTION_RESET:
      return "ACTION_RESET";
    case WaveUnit_Action.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

function createBaseWaveUnit(): WaveUnit {
  return { id: 0, action: 0, wave: new Uint8Array(0) };
}

export const WaveUnit = {
  encode(message: WaveUnit, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).int32(message.id);
    }
    if (message.action !== 0) {
      writer.uint32(16).int32(message.action);
    }
    if (message.wave.length !== 0) {
      writer.uint32(26).bytes(message.wave);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WaveUnit {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWaveUnit();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.id = reader.int32();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.action = reader.int32() as any;
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.wave = reader.bytes();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): WaveUnit {
    return {
      id: isSet(object.id) ? globalThis.Number(object.id) : 0,
      action: isSet(object.action) ? waveUnit_ActionFromJSON(object.action) : 0,
      wave: isSet(object.wave) ? bytesFromBase64(object.wave) : new Uint8Array(0),
    };
  },

  toJSON(message: WaveUnit): unknown {
    const obj: any = {};
    if (message.id !== 0) {
      obj.id = Math.round(message.id);
    }
    if (message.action !== 0) {
      obj.action = waveUnit_ActionToJSON(message.action);
    }
    if (message.wave.length !== 0) {
      obj.wave = base64FromBytes(message.wave);
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<WaveUnit>, I>>(base?: I): WaveUnit {
    return WaveUnit.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<WaveUnit>, I>>(object: I): WaveUnit {
    const message = createBaseWaveUnit();
    message.id = object.id ?? 0;
    message.action = object.action ?? 0;
    message.wave = object.wave ?? new Uint8Array(0);
    return message;
  },
};

function bytesFromBase64(b64: string): Uint8Array {
  if ((globalThis as any).Buffer) {
    return Uint8Array.from(globalThis.Buffer.from(b64, "base64"));
  } else {
    const bin = globalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}

function base64FromBytes(arr: Uint8Array): string {
  if ((globalThis as any).Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin: string[] = [];
    arr.forEach((byte) => {
      bin.push(globalThis.String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
