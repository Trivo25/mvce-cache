import {
  AccountUpdate,
  Mina,
  PrivateKey,
  Cache,
  Lightnet,
  fetchTransactionStatus,
  fetchAccount,
} from "o1js";
import {
  EthVerifier,
  CreateProofArgument,
  decodeConsensusMptProof,
  Bytes32FieldPair,
  EthInput,
  NodeProofLeft,
  EthProofType,
} from "@nori-zk/o1js-zk-utils";
import seriesExample1 from "./8695456/index.js";
import seriesExample2 from "./8695488/index.js";
import seriesExample3 from "./8695520/index.js";
import seriesExample4 from "./8695552/index.js";
import { EthProcessor } from "./ethProcessor.js";

const txFee = 0.1 * 1e9;

async function main() {
  const networkId = "testnet";
  const Network = Mina.Network({
    networkId,
    mina: "http://localhost:8080/graphql",
    lightnetAccountManager: "http://localhost:8181",
  });
  Mina.setActiveInstance(Network);
  console.log("Finished Mina network setup.");
  Lightnet;
  const sender = await Lightnet.acquireKeyPair();
  const senderPublicKey = sender.publicKey;

  console.log("Compiling EthVerifier...");
  await EthVerifier.compile({ cache: Cache.FileSystem("./cache") });
  console.log("Compiling EthProcessor...");
  await EthProcessor.compile({ cache: Cache.FileSystem("./cache") });

  const zkappKeyPair = PrivateKey.randomKeypair();
  const zkApp = new EthProcessor(zkappKeyPair.publicKey);
  const seriesExamples = [
    seriesExample1,
    seriesExample2,
    seriesExample3,
    seriesExample4,
  ];
  const decoded = decodeConsensusMptProof(seriesExamples[0].sp1PlonkProof);

  const deployTx = await Mina.transaction(
    { sender: senderPublicKey, fee: txFee },
    async () => {
      AccountUpdate.fundNewAccount(senderPublicKey);

      await zkApp.deploy();

      await zkApp.initialize(
        senderPublicKey,
        Bytes32FieldPair.fromBytes32(decoded.inputStoreHash)
      );
    }
  );
  console.log("Deploy transaction created successfully. Proving...");
  await deployTx.prove();
  console.log("Transaction proved. Signing and sending the transaction...");
  await deployTx
    .sign([sender.privateKey, zkappKeyPair.privateKey])
    .send()
    .wait();
  console.log("EthProcessor deployed successfully.");


  async function createProof(
    proofArguments: CreateProofArgument
  ): Promise<ReturnType<typeof EthVerifier.compute>> {
    try {
      console.log("Creating proof.");
      const { sp1PlonkProof, conversionOutputProof } = proofArguments;

      const rawProof = await NodeProofLeft.fromJSON(
        conversionOutputProof.proofData
      );

      const ethSP1Proof = sp1PlonkProof;

      console.log("Decoding converted proof and creating verification inputs.");

      // Decode proof values and create input for verification.
      const input = new EthInput(decodeConsensusMptProof(ethSP1Proof));

      // Compute and verify proof.
      console.log("Computing proof.");
      return EthVerifier.compute(input, rawProof);
    } catch (err) {
      console.error(`Error computing proof: ${String(err)}`);
      throw err;
    }
  }

  async function submit(ethProof: EthProofType) {
    console.log("Submitting a proof.");
    try {
      await fetchAccount({ publicKey: zkApp.address });
      await fetchAccount({
        publicKey: sender.publicKey,
      });
      console.log("Fetched accounts.");

      console.log("Creating update transaction.");
      const updateTx = await Mina.transaction(
        {
          sender: sender.publicKey,
          fee: txFee,
          memo: `State for slot ${ethProof.publicInput.outputSlot.toString()} set`,
        },
        async () => {
          await zkApp.update(ethProof);
        }
      );

      await updateTx.prove();
      console.log("Transaction proven.");

      const tx = await updateTx.sign([sender.privateKey]).send();
      const txId = tx.data!.sendZkapp.zkapp.id;
      const txHash = tx.data!.sendZkapp.zkapp.hash;
      if (!txId) {
        throw new Error("txId is undefined");
      }
      return {
        txId,
        txHash,
      };
    } catch (err) {
      console.error(`Error submitting proof: ${String(err)}`);
      throw err;
    }
  }

  //the bellow we could run in loop for each of the proofs,
  //as long as we don't compile ever again (even with cache)
  console.log(
    `Running Example-------------------------------------------------------`
  );
  // Build proof.
  const ethProof = await createProof(seriesExample2);

  // Submit proof.
  const result = await submit(ethProof.proof);

  console.log(`txHash: ${result.txHash}`);

  // Wait for finalization
  await wait(result.txId, process.env.MINA_RPC_NETWORK_URL as string);
  console.log(`Transaction finalized.`);

  console.log(
    `---------------------------------------------------------------------`
  );

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function wait(
  txId: string,
  minaRPCNetworkUrl: string,
  maxAttempts = 50,
  intervalMs = 20000
): Promise<boolean> {
  console.log(`Waiting for tx with id:\n${txId}`);
  let attempt = 0;
  do {
    try {
      console.log(`Fetching transaction status attempt '${attempt + 1}'.`);
      const status = await fetchTransactionStatus(txId, minaRPCNetworkUrl);
      console.log(
        `Received transaction status '${status}' for attempt '${attempt + 1}'.`
      );
      if (status === "INCLUDED") {
        return true;
      }
    } catch (err) {
      console.warn(
        // prettier-ignore
        `Error during fetchTransactionStatus (attempt '${attempt + 1}'):\n${String(err)}`
      );
    }
    attempt++;
    if (attempt < maxAttempts) await sleep(intervalMs);
  } while (attempt < maxAttempts);

  console.warn(`Max attempts exceeded while waiting for a tx. Aborting.`);

  throw new Error(
    `Max attempts exceeded while waiting for tx with id:\n${txId}`
  );
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
