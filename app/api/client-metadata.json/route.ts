export const runtime = 'edge';
import { clientMetadata } from '../../../lib/Def'

export async function GET(request: Request) {
    let client;
    client = clientMetadata();

    console.log(client);

    return new Response(JSON.stringify(client), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });
}
