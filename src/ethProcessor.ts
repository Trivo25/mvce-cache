import {
    Field,
    SmartContract,
    State,
    method,
    state,
    UInt64,
    PublicKey,
    Permissions,
    Provable,
    VerificationKey,
    assert,
    AccountUpdate,
} from 'o1js';
import { EthProof, Bytes32FieldPair } from '@nori-zk/o1js-zk-utils';

export class EthProofType extends EthProof { }

export class EthProcessor extends SmartContract {
    @state(PublicKey) admin = State<PublicKey>();
    @state(Field) verifiedStateRoot = State<Field>(); // todo make PackedString
    @state(UInt64) latestHead = State<UInt64>();
    @state(Field) latestHeliusStoreInputHashHighByte = State<Field>();
    @state(Field) latestHeliusStoreInputHashLowerBytes = State<Field>();
    @state(Field) latestVerifiedContractDepositsRootHighByte = State<Field>();
    @state(Field) latestVerifiedContractDepositsRootLowerBytes = State<Field>();

    //todo
    // events = { 'executionStateRoot-set': Bytes32.provable };//todo change type, if events even possible

    init(): void {
        // Init smart contract state (all zeros)
        super.init();
        // Set account permissions
        this.account.permissions.set({
            ...Permissions.default(),
            // Allow VK updates
            setVerificationKey:
                Permissions.VerificationKey.proofDuringCurrentVersion(),
        });
    }

    private async ensureAdminSignature() {
        const admin = await Provable.witnessAsync(PublicKey, async () => {
            let pk = await this.admin.fetch();
            assert(pk !== undefined, 'could not fetch admin public key');
            return pk;
        });
        Provable.asProver(() => {
            Provable.log('ensureAdminSignature', this.admin.get().toBase58(), admin.toBase58());
        });
        this.admin.requireEquals(admin);
        return AccountUpdate.createSigned(admin);
    }

    @method async setVerificationKey(vk: VerificationKey) {
        await this.ensureAdminSignature();
        this.account.verificationKey.set(vk);
    }

    @method async initialize(
        adminPublicKey: PublicKey,
        newStoreHash: Bytes32FieldPair
    ) {
        const isInitialized = this.account.provedState.getAndRequireEquals();
        isInitialized.assertFalse('EthProcessor has already been initialized!');

        this.admin.set(adminPublicKey);

        // Set initial state (TODO set these to real values!)
        this.latestHead.set(UInt64.from(0));
        this.verifiedStateRoot.set(Field(1));
        // Set inital state of store hash.
        // await this.updateStoreHash(newStoreHash); // Reintroduce this instead of the immediate below when we can
        // verify that this.admin.getAndRequireEquals() == adminPublicKey immediately after this.admin.set(adminPublicKey);
        this.latestHeliusStoreInputHashHighByte.set(newStoreHash.highByteField);
        this.latestHeliusStoreInputHashLowerBytes.set(
            newStoreHash.lowerBytesField
        );
    }


    @method async update(ethProof: EthProofType) {
        // Verify transition proof.
        ethProof.verify();
        // Pack the verifiedContractDepositsRoot into a pair of fields
        const verifiedContractDepositsRoot = Bytes32FieldPair.fromBytes32(
            ethProof.publicInput.verifiedContractDepositsRoot
        );
        // Update contract values      
        this.latestVerifiedContractDepositsRootHighByte.set(
            verifiedContractDepositsRoot.highByteField
        );
        this.latestVerifiedContractDepositsRootLowerBytes.set(
            verifiedContractDepositsRoot.lowerBytesField
        );
    }
}
