import { BrowserOAuthClient } from '@atproto/oauth-client-browser'
import {clientMetadata} from "./Def"
 
export function generateRandomState(length: number = 32): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  // バイナリデータを Base64 にエンコードし、URL 安全な形式に変換
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-') // Base64 の + を - に置換
    .replace(/\//g, '_') // Base64 の / を _ に置換
    .replace(/=+$/, ''); // Base64 の末尾の = を削除
}


export const createBrowserOAuthClient = (pdsUrl: string): BrowserOAuthClient => {
  const enc = encodeURIComponent
  const publicUrl = process.env.NEXT_PUBLIC_URL
  const url = publicUrl || `http://127.0.0.1:${process.env.NEXT_PUBLIC_PORT}`

  const obj = new BrowserOAuthClient({
    clientMetadata: clientMetadata(),
    handleResolver: "https://" + pdsUrl,
  })

  return obj
};




// デフォルトのエクスポート
export default createBrowserOAuthClient;