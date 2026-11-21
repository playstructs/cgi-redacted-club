// The Redacted Club overlay's runtime, loaded ahead of structs-webapp's entry.
//
// __rc.guild is the guild this page plays through, Redacted Club (guild.js),
// __rc.recovery moves a recovered player of another guild into it
// (recovery.js), __rc.pfp shows players' own pictures (pfp.js) and
// __rc.bunnies lets a player pick their Redacted Club bunny at sign-up
// (bunnies.js). rc/patches.cjs points webapp's code at them.
// __rc.account creates the account at sign-up without showing its recovery
// key, and offers Download Player in place of Log Out (account.js).
import {guild} from './guild.js';
import {recovery} from './recovery.js';
import * as pfp from './pfp.js';
import {bunnies} from './bunnies.js';
import {account} from './account.js';

globalThis.__rc = Object.freeze({guild, recovery, pfp: Object.freeze({...pfp}), bunnies, account});
