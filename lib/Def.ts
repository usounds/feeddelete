
import { OAuthClientMetadataInput } from '@atproto/oauth-types';

export type Feed = {
    feedAvater: string | undefined,
    feedName: string,
    feedDescription: string | undefined,
    feedAtUri: string,
    feedUrl: string,
    did: string,
    error: string | undefined,

}


export function clientMetadata(): OAuthClientMetadataInput {

    const enc = encodeURIComponent

    const publicUrl = process.env.NEXT_PUBLIC_URL
    const url = publicUrl || `http://127.0.0.1:${process.env.NEXT_PUBLIC_PORT}`
    const returnObject: OAuthClientMetadataInput = {
        client_name: 'AT Protocol Express App',
        client_id: publicUrl
            ? `${publicUrl}/api/client-metadata.json`
            : `http://localhost?redirect_uri=${enc(`${url}/`)}&scope=${enc('atproto transition:generic')}`,
        client_uri: url,
        redirect_uris: [`${url}/`],
        scope: 'atproto transition:generic',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        application_type: 'web',
        token_endpoint_auth_method: 'none',
        dpop_bound_access_tokens: true,
    };

    return returnObject;
}