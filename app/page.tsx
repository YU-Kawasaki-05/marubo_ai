/** @file
 * ルートページ（/）→ /chat にリダイレクト。
 * β版では LP 不要。一般公開時に LP が必要になったらリダイレクトを外して
 * このファイルに LP コンポーネントを置けばよい。
 * 依存: next/navigation (redirect)
 */

import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/chat')
}
