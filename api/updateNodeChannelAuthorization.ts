import { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddAuthorizedNodeRequest, isAddNodeChannelMembershipRequest, isUpdateNodeChannelAuthorizationRequest, NodeChannelAuthorization, NodeChannelMembership } from '../src/common/types'
import firestoreDatabase from './common/firestoreDatabase'
import googleVerifyIdToken from './common/googleVerifyIdToken'

module.exports = (req: VercelRequest, res: VercelResponse) => {    
    const {body: request} = req
    if (!isUpdateNodeChannelAuthorizationRequest(request)) {
        res.status(400).send(`Invalid request: ${JSON.stringify(request)}`)
        return
    }

    ;(async () => {
        const auth = request.auth
        if (!auth.userId) throw Error('No auth user id')
        if (!auth.googleIdToken) throw Error('No google id token')
        const verifiedUserId = await googleVerifyIdToken(auth.userId, auth.googleIdToken)

        const db = firestoreDatabase()
        const channelsCollection = db.collection('channels')
        const channelResults = await channelsCollection
            .where('channelName', '==', request.authorization.channelName).get()
        if (channelResults.docs.length === 0) {
            throw Error(`Channel with name "${request.authorization.channelName}" does not exist.`)
        }
        if (channelResults.docs.length > 1) {
            throw Error(`Unexpected: more than one channel with name ${request.authorization.channelName}`)
        }
        const doc = channelResults.docs[0]
        if (verifiedUserId !== doc.get('ownerId')) {
            throw Error('Not authorized')
        }
        const authorizedNodes: NodeChannelAuthorization[] = doc.get('authorizedNodes') || []
        if (!authorizedNodes.map(x => x.nodeId).includes(request.authorization.nodeId)) {
            throw Error('Authorized node not found')
        }
        await doc.ref.update({
            authorizedNodes: authorizedNodes.map(x => (x.nodeId === request.authorization.nodeId ? request.authorization : x))
        })
        return {success: true}
    })().then((result) => {
        res.json(result)
    }).catch((error: Error) => {
        console.warn(error.message)
        res.status(404).send(`Error: ${error.message}`)
    })
}