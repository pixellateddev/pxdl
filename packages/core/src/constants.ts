import { homedir } from 'node:os'
import { join } from 'node:path'

export const CONFIG_DIR = join(homedir(), '.pxdl')
export const DAEMON_PORT = 18281
export const API_BASE = `http://localhost:${DAEMON_PORT}`
export const PID_FILE = join(CONFIG_DIR, 'daemon.pid')
export const LOG_FILE = join(CONFIG_DIR, 'daemon.log')
export const DB_PATH = join(CONFIG_DIR, 'pxdl.db')
