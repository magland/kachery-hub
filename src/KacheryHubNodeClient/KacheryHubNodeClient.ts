import axios from "axios"
import { publicKeyToHex, publicKeyHexToNodeId, getSignature } from "../kachery-js/types/crypto_util"
import { KeyPair, UserId } from "../kachery-js/types/kacheryTypes"
import {GetNodeConfigRequestBody, isGetNodeConfigResponse, KacheryNodeRequest} from '../kachery-js/types/kacheryNodeRequestTypes'
import { isNodeConfig, NodeConfig } from "../kachery-js/types/kacheryHubTypes"

class KacheryHubNodeClient {
    #initialized = false
    #initializing = false
    #onInitializedCallbacks: (() => void)[] = []
    #nodeConfig: NodeConfig | undefined = undefined
    constructor(private opts: {keyPair: KeyPair, ownerId: UserId, kacheryHubUrl?: string}) {
    }
    async initialize() {
        if (this.#initialized) return
        if (this.#initializing) {
            return new Promise<void>((resolve) => {
                this.onInitialized(() => {
                    resolve()
                })
            })
        }
        this.#initializing = true

        const reqBody: GetNodeConfigRequestBody = {
            type: 'getNodeConfig',
            nodeId: this.nodeId,
            ownerId: this.opts.ownerId
        }
        const req: KacheryNodeRequest = {
            body: reqBody,
            nodeId: this.nodeId,
            signature: getSignature(reqBody, this.opts.keyPair)
        }
        const x = await axios.post(`${this._kacheryHubUrl()}/api/getNodeConfig`, req)
        const resp = x.data
        if (!isGetNodeConfigResponse(resp)) {
            throw Error('Invalid response in getNodeConfig')
        }
        if (!resp.found) {
            throw Error('Node not found for getNodeConfig')
        }
        const nodeConfig = resp.nodeConfig
        if (!nodeConfig) throw Error('Unexpected, no nodeConfig')
        this.#nodeConfig = nodeConfig

        this.#initialized = true
        this.#initializing = false
    }
    public get nodeConfig() {
        return this.#nodeConfig
    }
    public get nodeId() {
        return publicKeyHexToNodeId(publicKeyToHex(this.opts.keyPair.publicKey))
    }
    public get channelMemberships() {
        if (!this.#nodeConfig) return undefined
        return this.#nodeConfig.channelMemberships
    }
    onInitialized(callback: () => void) {
        this.#onInitializedCallbacks.push(callback)
    }
    _kacheryHubUrl() {
        return this.opts.kacheryHubUrl || 'https://kachery-hub.vercel.app'
    }
}

export default KacheryHubNodeClient