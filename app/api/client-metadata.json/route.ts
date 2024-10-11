export const runtime = 'edge';
import { clientMetadata } from '../../../lib/Def'

export async function GET() {
    return new Response(JSON.stringify(clientMetadata()), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });
}
