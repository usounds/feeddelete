"use client"
export const runtime = 'edge';
import { Agent } from "@atproto/api"
import { BrowserOAuthClient, OAuthSession } from '@atproto/oauth-client-browser'
import { useState, useEffect, useRef } from 'react'
import { clientMetadata } from '../lib/Def';
import { Feed } from '../lib/Def'

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pdsUrl, setPdsUrl] = useState("bsky.social");
  const [phase, setPhase] = useState<number>(1);
  const [isFeedLoading, setIsFeedLoading] = useState<boolean>(false);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [oauthMessage, setOauthMessage] = useState("");
  const [currentFeed, setCurrentFeed] = useState(0);
  const [maxFeeds, setMaxFeeds] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Feed | undefined>();
  const [deleteError, setDeleteError] = useState("");

  const [oauthAgent, setOauthAgent] = useState<Agent | undefined>();
  const ignoreRef = useRef(false); // useRefを使ってignoreを管理

  function convertUrl(inputUrl: string): string | null {
    // 正規表現を使って、URLのパーツをキャプチャ
    const regex = /^at:\/\/(did:plc:[a-zA-Z0-9]+)\/(app\.bsky\.feed\.generator\/)?(.*)$/; // did:plc:を含む正規表現
    const match = inputUrl.match(regex);

    if (match) {
      // キャプチャした部分を使用して、新しいURLを生成
      const userId = match[1]; // did:plc の後の部分
      const path = match[3];    // 最後の部分（app.bsky.feed.generator/unofficial）

      // 新しいURLを組み立てる
      return `https://bsky.app/profile/${userId}/feed/${path}`;
    }

    // マッチしなかった場合は null を返す
    return null;
  }


  function generateRandomState(length: number = 32): string {
    const array = new Uint8Array(length);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    }
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-') // Base64 の + を - に置換
      .replace(/\//g, '_') // Base64 の / を _ に置換
      .replace(/=+$/, ''); // Base64 の末尾の = を削除
  }


  useEffect(() => {
    
    const fetchData = async () => {

      if (ignoreRef.current) return;
      ignoreRef.current = true; // ignoreをtrueに設定

      let result;

      const localState = window.localStorage.getItem('state');
      const localPdsUrl = window.localStorage.getItem('pdsUrl');
      if (localPdsUrl) setPdsUrl(localPdsUrl);

      try {
        if (localState && localPdsUrl && typeof window !== 'undefined' && window.navigator) {

          const publicUrl = process.env.NEXT_PUBLIC_URL;
          const url = publicUrl || `http://127.0.0.1:${process.env.NEXT_PUBLIC_PORT}`;

          const oauthClient = new BrowserOAuthClient({
            clientMetadata: clientMetadata(), // これもクライアントサイドでの呼び出しが必要
            handleResolver: 'https://' + pdsUrl,
          });

          result = await oauthClient.init() as undefined | { session: OAuthSession; state?: string | undefined };
        }
      } catch (e) {
        console.error("Authentication failed:", e); // 認証失敗のエラーログ
        setOauthMessage("Authentication failed:" + e)
        setIsLoading(false);
        return;
      }

      if (result) {
        const { session, state } = result;

        // OAuth認証から戻ってきた場合
        if (state != null) {
          // stateがズレている場合はエラー
          if (state !== localState) {
            console.error("State mismatch error"); // エラーログ
            setOauthMessage("stateが一致しません")
            setIsLoading(false);
            return;
          }

          let localOauthAgent = new Agent(session);
          setOauthAgent(localOauthAgent)
          console.log(`${localOauthAgent.assertDid} was successfully authenticated (state: ${state})`)


          setPhase(2)
          setIsFeedLoading(true)

          let cursor = '';
          const feeds: Feed[] = [];

          let localCurrentCount = 0
          let localFeedsMax = 0

          do {
            const params_search = {
              actor: localOauthAgent.assertDid,
              limit: 100,
              cursor: cursor,
            };

            // getActorFeeds を呼び出す
            const ret = await localOauthAgent.app.bsky.feed.getActorFeeds(params_search);

            localFeedsMax = ret.data.feeds.length + localFeedsMax
            setMaxFeeds(localFeedsMax)

            // 新しいフィードを取得
            for (let obj of ret.data.feeds) {
              localCurrentCount++
              setCurrentFeed(localCurrentCount)
              const params_search = {
                feed: obj.uri,
                limit: 1,
              };
              let errorMessage = ''
              try {
                console.log('aaaaa');
                const ret2 = await localOauthAgent.app.bsky.feed.getFeed(params_search);
              } catch (e) {
                console.error(e);

                // eがError型の場合にメッセージを取得
                errorMessage = e instanceof Error ? e.message : "不明なエラーが発生しました";
                errorMessage = `そのサーバーからのエラー: ${errorMessage}`;

              }

              let server = obj.did
              if (server.startsWith('did:web:'))
                server = server.replace('did:web:', '')
              feeds.push({
                feedAvater: obj.avatar,
                feedName: obj.displayName,
                feedDescription: obj.description,
                feedAtUri: obj.uri,
                did: server,
                feedUrl: convertUrl(obj.uri) || '',
                error: errorMessage
              });
              setFeeds(feeds)

            }

            // 次のカーソルを更新
            cursor = ret.data.cursor || '';
          } while (cursor); // cursor が空でない間ループを続ける

        }
      }


      setIsLoading(false);
      setIsFeedLoading(false)

    };

    fetchData();
  }, []); // 依存配列が空であることを確認

  const oauthLogin = async () => {
    setIsLoading(true)
    setOauthMessage("")

    const oauthClient = new BrowserOAuthClient({
      clientMetadata: clientMetadata(), // これもクライアントサイドでの呼び出しが必要
      handleResolver: 'https://' + pdsUrl,
    });

    const state = generateRandomState()
    window.localStorage.setItem('state', state)
    window.localStorage.setItem('pdsUrl', pdsUrl)

    const oooo = await oauthClient.signIn("https://" + pdsUrl, {
      state: state,
      prompt: 'consent', // Attempt to sign in without user interaction (SSO)
      ui_locales: 'ja-JP', // Only supported by some OAuth servers (requires OpenID Connect support + i18n support)
      signal: new AbortController().signal, // Optional, allows to cancel the sign in (and destroy the pending authorization, for better security)
    })
  }


  const handleDelete = async (feed: Feed) => {
    setIsLoading(true)
    setDeleteError("")
    const success = '非表示にしました:'+feed.feedName
    if (oauthAgent === undefined) {
      setDeleteError("未ログインです")
      return
    }

    let recordName = feed.feedAtUri.split('/').pop();

    console.log(oauthAgent)
    let record = {
      repo: oauthAgent.assertDid || '',
      collection: 'app.bsky.feed.generator',
      rkey: recordName || '',
    }

    try {
      await oauthAgent.com.atproto.repo.deleteRecord(
        record
      )
      setDeleteTarget(undefined)
      setFeeds(feeds.filter((f) => f !== feed))
      setDeleteError(success)
    }
    catch (e) {
      setDeleteError("Error:" + e)

    }
    setIsLoading(false)

  }


  return (
    <div className="flex justify-center items-center max-w-[800px] mx-auto mt-10">
      <main className="flex flex-col items-center sm:items-start text-sm text-center sm:text-left">
        <p className='mb-10'>Blueskyのプロフィールのフィードからフィードを非表示にするツールです。何らかの理由でジェネレーターから公開の取り消しやUnpublishができない場合に使ってください。</p>

        {false &&
          <ol className="items-center w-full space-y-4 justify-between sm:flex sm:space-x-8 sm:space-y-0 rtl:space-x-reverse mb-5">
            <li className="flex items-center text-blue-600 dark:text-blue-500 space-x-2.5 rtl:space-x-reverse">
              <span className="flex items-center justify-center w-8 h-8 border border-blue-600 rounded-full shrink-0 dark:border-blue-500">
                1
              </span>
              <span>
                <h3 className="font-medium leading-tight">ログイン</h3>
                <p className="text-sm">Bluesky OAuth</p>
              </span>
            </li>
            <li className="flex items-center text-gray-500 dark:text-gray-400 space-x-2.5 rtl:space-x-reverse">
              <span className="flex items-center justify-center w-8 h-8 border border-gray-500 rounded-full shrink-0 dark:border-gray-400">
                2
              </span>
              <span>
                <h3 className="font-medium leading-tight">フィード</h3>
                <p className="text-sm">非表示にするフィード</p>
              </span>
            </li>
            <li className="flex items-center text-gray-500 dark:text-gray-400 space-x-2.5 rtl:space-x-reverse">
              <span className="flex items-center justify-center w-8 h-8 border border-gray-500 rounded-full shrink-0 dark:border-gray-400">
                3
              </span>
              <span>
                <h3 className="font-medium leading-tight">確認</h3>
                <p className="text-sm">削除します</p>
              </span>
            </li>
          </ol>
        }

        {phase === 1 &&
          <div className="flex items-center flex-col w-full">

            <div>
              <label className="block text-sm text-white">セルフホストPDSを使っている方以外は、そのままログインしてください</label>
              <div className="flex items-center mt-2">
                <p className="py-2.5 px-3 text-gray-100 bg-gray-800 border-gray-800 border border-r-0 rtl:rounded-r-lg rtl:rounded-l-none rtl:border-l-0 rtl:border-r rounded-l-lg">https://</p>
                <input value={pdsUrl} onChange={(event) => setPdsUrl(event.target.value)} type="text" placeholder="bsky.social" className="block w-full rounded-l-none rtl:rounded-l-lg rtl:rounded-r-none placeholder-gray-400/70 dark:placeholder-gray-500 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-gray-700 focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-300 focus:ring-opacity-40 dark:border-gray-600 " />
              </div>
            </div>

            <button
              onClick={oauthLogin}
              className="rounded-full w-[200px] sm:w-[300px] mt-4 my-2 border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-1 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            >
              {!isLoading ? (
                <>
                  <svg className="h-5 w-5 mr-2" width="24" height="24" viewBox="0 0 1452 1452" xmlns="http://www.w3.org/2000/svg">
                    <path d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z" fill="currentColor" />
                  </svg>
                  ログイン
                </>
              ) : (
                <>
                  <span className="animate-spin inline-block size-4 mr-2 border-[3px] border-current border-t-transparent text-gray-700 rounded-full" role="status" aria-label="loading" />
                </>
              )}
            </button>


            {oauthMessage && <p className="text-red-500">{oauthMessage}</p>}

          </div>
        }

        {phase === 2 && feeds && (
          <>
            {isFeedLoading ? <div>
              <span className="animate-spin inline-block size-4 mr-2 border-[3px] border-current border-t-transparent text-gray-700 rounded-full" role="status" aria-label="loading" />
              あなたのフィードの状況を確認しています [ {currentFeed}/ {maxFeeds}]</div> : <div>チェックが完了しました[ {currentFeed}/ {maxFeeds}]</div>}
            {isFeedLoading &&
              <div
                className="flex w-full h-4 mb-2 bg-gray-200 rounded-full overflow-hidden dark:bg-neutral-700"
                role="progressbar"
                aria-valuenow={25}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {/* ブルーの進捗バーをグレーの中に配置 */}
                <div
                  className="flex flex-col justify-left rounded-full overflow-hidden bg-blue-600 text-xs text-white text-center whitespace-nowrap dark:bg-blue-500 transition duration-500"
                  style={{ width: `${(currentFeed / maxFeeds) * 100}%` }}  // 進捗状況に応じて幅を指定
                >
                </div>
              </div>
            }


            {deleteTarget &&
              <div className="border rounded-lg mb-2 p-1 flex items-center w-full" >
                <div className="flex-shrink-0 mr-2">
                  {deleteTarget.feedAvater && (
                    <img
                      src={deleteTarget.feedAvater}
                      alt="Feed Avatar"
                      className="h-12 w-12 object-cover rounded-full" // 高さ12（48px）、幅12に指定
                    />
                  )}
                </div>
                <div className="flex-grow"> {/* テキスト部分を広げる */}
                  <p>
                    <span>{deleteTarget.feedName || "《フィード名が空です》"}</span> {/* Feed名を表示 */}
                  </p>
                  <div>稼働サーバー：{deleteTarget.did}</div>
                  {deleteTarget.error && <div className="text-red-500">{deleteTarget.error}</div>}
                </div>
                {/* 右端に配置される非表示ボタン */}
                <div className="ml-auto text-red-500 hover:underline text-right" onClick={() => handleDelete(deleteTarget)}>
                  本当に非表示にする
                </div>
              </div>


            }

            {deleteError && <p className="text-red-500">{deleteError}</p>}

            <div className="text-left">
              {feeds.map((obj: Feed, index) => (
                <div className="border rounded-lg mb-2 p-1 flex items-center w-full" key={index}>
                  <div className="flex-shrink-0 mr-2">
                    {obj.feedAvater && (
                      <img
                        src={obj.feedAvater}
                        alt="Feed Avatar"
                        className="h-12 w-12 object-cover rounded-full" // 高さ12（48px）、幅12に指定
                      />
                    )}
                  </div>
                  <div className="flex-grow"> {/* テキスト部分を広げる */}
                    <p>
                      <span> <a href={obj.feedUrl}>{obj.feedName || "《フィード名が空です》"}({obj.feedUrl.split('/').pop()})</a></span> {/* Feed名を表示 */}
                    </p>
                    <div>稼働サーバー：{obj.did}</div>
                    {obj.error && <div className="text-red-500">{obj.error}</div>}
                  </div>
                  {/* 右端に配置される非表示ボタン */}
                  <div className="ml-auto text-red-500 hover:underline text-right"
                    onClick={() => {
                      setDeleteError("")
                      setDeleteTarget(obj); // セミコロンでステートメントを区切る
                      window.scrollTo({
                        top: 0,
                        behavior: 'smooth', // スムーズなスクロール
                      });
                    }}
                  >
                    選択
                  </div>
                </div>
              ))}
            </div>


            {isFeedLoading ? <div>
              <span className="animate-spin inline-block size-4 mr-2 border-[3px] border-current border-t-transparent text-gray-700 rounded-full" role="status" aria-label="loading" />
              あなたのフィードの状況を確認しています [ {currentFeed}/ {maxFeeds}]</div> : "もうないよ"}

          </>
        )}



      </main>

    </div >
  );
}
