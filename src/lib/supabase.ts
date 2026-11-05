import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase 연결 (대회 모드 전용).
 * 환경 변수가 없으면 null — 이때 대회 모드는 꺼지고 시뮬레이션 모드만 쓸 수 있다.
 *  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (anon 키는 브라우저에 노출돼도 되는 공개용 키)
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null

export const isContestServerConfigured = supabase !== null
