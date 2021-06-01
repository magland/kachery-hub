import { VercelRequest, VercelResponse } from '@vercel/node'
import { ChannelConfig, isChannelConfig, isGetChannelsForUserRequest } from '../src/common/types'
import firestoreDatabase from './common/firestoreDatabase'
import googleVerifyIdToken from './common/googleVerifyIdToken'
import hideChannelSecrets from './common/hideChannelSecrets'

module.exports = (req: VercelRequest, res: VercelResponse) => {    
    const {body: request} = req
    if (!isGetChannelsForUserRequest(request)) {
        res.status(400).send(`Invalid request: ${JSON.stringify(request)}`)
        return
    }

    ;(async () => {
        const auth = request.auth
        if (!auth.userId) throw Error('No auth user id')
        if (!auth.googleIdToken) throw Error('No google id token')
        const verifiedUserId = await googleVerifyIdToken(auth.userId, auth.googleIdToken)
        if (verifiedUserId !== request.userId) {
            throw Error('Not authorized')
        }

        const db = firestoreDatabase()
        const channelsCollection = db.collection('channels')
        const channelResults = await channelsCollection.where('ownerId', '==', request.userId).get()
        const ret: ChannelConfig[] = []
        for (let doc of channelResults.docs) {
            const x = doc.data()
            if (isChannelConfig(x)) {
                if (!x.deleted) {
                    ret.push(hideChannelSecrets(x))
                }
            }
            else {
                console.warn('Not a valid channel config', x)
            }
        }
        return ret
    })().then((result) => {
        res.json(result)
    }).catch((error: Error) => {
        console.warn(error.message)
        res.status(404).send(`Error: ${error.message}`)
    })
}