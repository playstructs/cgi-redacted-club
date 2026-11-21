// Choosing a Redacted Club bunny as the profile picture at sign-up.
//
// The bunnies are SNIP-721 tokens on Secret Network, whose holdings are
// private: as on redactedclub.com, the player connects Keplr, creates a viewing
// key once (a Secret Network transaction Keplr asks them to approve) and the
// contract lists their tokens to that key. The chosen bunny's image, as
// redactedclub.com hosts it, becomes the player's picture (pfp.js).
//
// secretjs is loaded only when a player asks for their bunnies.
import {bunnyUrl} from './pfp.js';

const CONTRACT_ADDRESS = 'secret1vavc4azfjqkcs8rj0rkcl3v45c4ddu54jqfhhq';
const CHAIN_ID = 'secret-4';
const LCD_URLS = [
  'https://rest.lavenderfive.com:443/secretnetwork',
  'https://secret.api.trivium.network:1317',
];
const VK_STORAGE_KEY = 'rc.bunnies.viewing-keys';
const PAGE_SIZE = 30;

const escape = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const short = address => `${address.slice(0, 10)}…${address.slice(-6)}`;

function storedKey(address) {
  try {
    return JSON.parse(localStorage.getItem(VK_STORAGE_KEY) || '{}')[address] || null;
  } catch {
    return null;
  }
}

function storeKey(address, key) {
  try {
    const keys = JSON.parse(localStorage.getItem(VK_STORAGE_KEY) || '{}');
    if (key) keys[address] = key; else delete keys[address];
    localStorage.setItem(VK_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Without storage the key is asked for again next time.
  }
}

function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function waitForKeplr(timeout = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (window.keplr?.getEnigmaUtils) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return !!window.keplr;
}

/** Keplr and a Secret Network client for its first account. */
async function connect() {
  if (!await waitForKeplr()) {
    throw Object.assign(new Error('Keplr not found'), {code: 'no-keplr'});
  }
  try {
    await window.keplr.enable(CHAIN_ID);
  } catch {
    throw Object.assign(new Error('Keplr connection declined'), {code: 'declined'});
  }
  const signer = window.keplr.getOfflineSignerOnlyAmino(CHAIN_ID);
  const [{address}] = await signer.getAccounts();
  const {SecretNetworkClient} = await import(/* webpackChunkName: "secretjs" */ 'secretjs');

  for (const url of LCD_URLS) {
    try {
      const client = new SecretNetworkClient({
        url,
        chainId: CHAIN_ID,
        wallet: signer,
        walletAddress: address,
        encryptionUtils: window.keplr.getEnigmaUtils(CHAIN_ID),
      });
      const hash = await client.query.compute.codeHashByContractAddress({contract_address: CONTRACT_ADDRESS});
      const codeHash = typeof hash === 'string' ? hash : hash?.code_hash ?? hash?.codeHash;
      if (codeHash) return {client, address, codeHash};
    } catch (error) {
      console.warn(`[rc] bunnies: ${url} failed: ${error.message}`);
    }
  }
  throw new Error('Secret Network could not be reached. Please try again later.');
}

/** @return {Promise<string[]>} the token ids the address holds */
async function ownedTokens({client, address, codeHash}, viewingKey) {
  const tokens = [];
  let startAfter = null;
  for (;;) {
    const query = {owner: address, viewer: address, viewing_key: viewingKey, limit: PAGE_SIZE};
    if (startAfter) query.start_after = startAfter;
    const result = await client.query.compute.queryContract({
      contract_address: CONTRACT_ADDRESS,
      code_hash: codeHash,
      query: {tokens: query},
    });
    if (typeof result === 'string' || result?.viewing_key_error || result?.generic_err) {
      throw Object.assign(new Error('viewing key rejected'), {code: 'viewing-key'});
    }
    const page = result?.token_list?.tokens ?? result?.tokens?.tokens ?? [];
    tokens.push(...page);
    if (page.length < PAGE_SIZE) break;
    startAfter = page[page.length - 1];
  }
  return tokens.filter(id => /^\d{1,5}$/.test(id)).sort((a, b) => a - b);
}

async function createViewingKey({client, address, codeHash}) {
  const key = randomKey();
  const tx = await client.tx.compute.executeContract({
    contract_address: CONTRACT_ADDRESS,
    code_hash: codeHash,
    sender: address,
    msg: {set_viewing_key: {key}},
  }, {gasLimit: 50_000});
  if (tx.code !== 0) {
    throw new Error(tx.rawLog || 'The viewing key transaction failed.');
  }
  storeKey(address, key);
  return key;
}

/**
 * Adds "Use my bunny" to the sign-up profile screen (SetUsernameViewModel,
 * patched to call this once its picture is shown).
 *
 * @param {object} viewModel SetUsernameViewModel
 * @param {object} menuPage webapp's MenuPage
 */
function mount(viewModel, menuPage) {
  const refresh = document.getElementById(viewModel.regeneratePfpBtnId);
  const body = document.querySelector('.set-username-screen-body');
  if (!refresh || !body) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'rc-bunny-btn';
  button.className = 'sui-screen-btn rc-bunny-btn';
  button.textContent = 'Use my bunny';
  refresh.after(button);

  const panel = document.createElement('div');
  panel.id = 'rc-bunny-picker';
  panel.className = 'rc-bunny-picker hidden';
  body.append(panel);

  let wallet = null;
  let busy = false;

  const show = content => {
    panel.innerHTML = `
      <div class="rc-bunny-picker-header">
        <span class="sui-text-header">Redacted Club bunnies</span>
        <button type="button" class="rc-bunny-picker-close" aria-label="Close">&times;</button>
      </div>
      <div class="rc-bunny-picker-body">${content}</div>`;
    panel.classList.remove('hidden');
    panel.querySelector('.rc-bunny-picker-close').addEventListener('click', close);
  };
  const close = () => panel.classList.add('hidden');
  const message = text => show(`<p class="rc-bunny-picker-message">${text}</p>`);

  const choose = id => {
    const component = viewModel.pfpViewerComponent;
    const url = bunnyUrl(id);
    // The generated layers stay, under the bunny, for clients that don't show URLs.
    component.pfp = {...(component.pfp ?? {}), url};
    component.render();
    viewModel.gameState.signupRequest.pfp_client_render_attributes = component.getPfpJson();
    close();
    menuPage.setDialogueScreenContent(`Redacted Club #${escape(id)} it is. Now, your display name.`, true);
  };

  const list = tokens => {
    if (tokens.length === 0) {
      message(`No Redacted Club bunnies found in <strong>${escape(short(wallet.address))}</strong>.`);
      return;
    }
    show(`
      <p class="rc-bunny-picker-message">${escape(short(wallet.address))} holds ${tokens.length}. Pick one.</p>
      <div class="rc-bunny-grid">
        ${tokens.map(id => `
          <button type="button" class="rc-bunny-tile" data-token="${escape(id)}" title="Redacted Club #${escape(id)}">
            <img src="${escape(bunnyUrl(id))}" alt="Redacted Club #${escape(id)}" loading="lazy">
            <span>#${escape(id)}</span>
          </button>`).join('')}
      </div>`);
    panel.querySelectorAll('.rc-bunny-tile').forEach(tile => {
      tile.addEventListener('click', () => choose(tile.dataset.token));
    });
  };

  const askForKey = () => {
    show(`
      <p class="rc-bunny-picker-message">
        Bunnies are private on Secret Network. To see yours, Keplr will ask you to
        approve a viewing key for the Redacted Club contract: one transaction,
        with a small SCRT fee.
      </p>
      <button type="button" class="sui-screen-btn rc-bunny-key-btn">Create viewing key</button>`);
    panel.querySelector('.rc-bunny-key-btn').addEventListener('click', () => run(async () => {
      message('Approve the viewing key in Keplr…');
      list(await ownedTokens(wallet, await createViewingKey(wallet)));
    }));
  };

  const load = async () => {
    if (!wallet) {
      message('Connecting to Keplr…');
      wallet = await connect();
    }
    const key = storedKey(wallet.address);
    if (!key) {
      askForKey();
      return;
    }
    message('Looking for your bunnies…');
    try {
      list(await ownedTokens(wallet, key));
    } catch (error) {
      if (error.code !== 'viewing-key' && !/viewing key|unauthori/i.test(error.message ?? '')) throw error;
      storeKey(wallet.address, null);
      askForKey();
    }
  };

  const run = async task => {
    if (busy) return;
    busy = true;
    try {
      await task();
    } catch (error) {
      console.warn('[rc] bunnies:', error);
      if (error.code === 'no-keplr') {
        message('Keplr wasn\'t found. Install the <a href="https://www.keplr.app/" target="_blank" rel="noopener">Keplr</a> browser extension, then reload this page.');
      } else if (error.code === 'declined') {
        message('Keplr didn\'t connect. Try again when you\'re ready.');
      } else if (/rejected/i.test(error.message ?? '')) {
        message('Request rejected in Keplr. Try again when you\'re ready.');
      } else {
        message(escape(error.message || 'Something went wrong.'));
      }
    } finally {
      busy = false;
    }
  };

  button.addEventListener('click', () => run(load));
}

/** The profile is confirmed: the picture can't change any more. */
function lock() {
  document.getElementById('rc-bunny-btn')?.remove();
  document.getElementById('rc-bunny-picker')?.remove();
}

export const bunnies = Object.freeze({mount, lock});
