import { ZkProgram, Field, Gadgets, createForeignField, Bytes, Poseidon, UInt8, CanonicalForeignField, Bool, Provable  } from "o1js";

export class Bytes32 extends Bytes(32) {}
class Fr extends createForeignField(21888242871839275222246405745257275088548364400416034343698204186575808495617n) {
}
class FrU extends Fr.Unreduced {
}
class FrA extends Fr.AlmostReduced {
}
class FrC extends Fr.Canonical {
}

function powFr(x: FrC, exp: Array<number>): CanonicalForeignField {
    let r = Fr.from(x).assertCanonical();
    const n = exp.length;
    for (let i = 1; i < n; i++) {
        r = r.mul(r).assertCanonical();
        if (exp[i] == 1) {
            r = r.mul(x).assertCanonical();
        }
    }
    return r;
}
function xorFr(x: FrC, y: FrC): CanonicalForeignField {
    let fieldsX = x.toFields();
    let fieldsY = y.toFields();
    let xoredFields = [];
    for (let i = 0; i < 3; i++) {
        xoredFields.push(Gadgets.xor(fieldsX[i], fieldsY[i], 96));
    }
    return FrC.provable.fromFields(xoredFields);
}

export function shaToFr(hashDigest: Bytes) {
    let fields = hashDigest.toFields();
    const shaBitRepr = [];
    let bit255 = Bool(false);
    let bit256 = Bool(false);
    for (let i = 31; i >= 0; i--) {
        const bits = fields[i].toBits();
        for (let j = 0; j < 8; j++) {
            // we skip last 2 bits
            if (i == 0 && j == 6) {
                bit255 = bits[j];
            }
            else if (i == 0 && j == 7) {
                bit256 = bits[j];
            }
            else {
                shaBitRepr.push(bits[j]);
            }
        }
    }
    const sh254 = FrC.from(7059779437489773633646340506914701874769131765994106666166191815402473914367n); // 2^254 % r
    const sh255 = FrC.from(14119558874979547267292681013829403749538263531988213332332383630804947828734n); // 2^255 % r
    let x = FrU.fromBits(shaBitRepr);
    const a = Provable.if(bit255.equals(Bool(true)), FrC.provable, sh254, FrC.from(0n));
    const b = Provable.if(bit256.equals(Bool(true)), FrC.provable, sh255, FrC.from(0n));
    const res = x.add(a).add(b).assertCanonical();
    return res;
}

export function parseDigestProvable(digest: Bytes) {
    const k = [Field.from(0x1fn), ...Array(31).fill(Field.from(0xffn))];
    const fields = digest.toFields();
    let bytes = [];
    for (let i = 0; i < 32; i++) {
        bytes.push(UInt8.Unsafe.fromField(Gadgets.and(fields[i], k[i], 8)));
    }
    return shaToFr(Bytes32.from(bytes));
}

export function parsePublicInputsProvable(piBytes: Bytes) {
    const digest = Gadgets.SHA256.hash(piBytes);
    return parseDigestProvable(digest);
}

const DUMMY_HEX_32 =
  "deadbeefcafebabe000000000000000000000000000000000000000000000000";

export const dummyBytes32 = Bytes32.fromHex(DUMMY_HEX_32);

const ShaGadgetIssue = ZkProgram({
  name: "EthVerifier",
  publicInput: Field,
  publicOutput: Field,
  methods: {
    compute: {
      privateInputs: [],
      async method(input: Field) {
        const data = dummyBytes32;
        const hashFields = Gadgets.SHA2.hash(256, data).toFields();
        return {
          publicOutput: Poseidon.hash(hashFields),
        };
      },
    },
  },
});

const ShaGadgetProof = ZkProgram.Proof(ShaGadgetIssue);

export { ShaGadgetIssue, ShaGadgetProof };
