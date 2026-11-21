// Choosing a Redacted Club bunny as the profile picture at sign-up.
//
// "Choose bunny", beside the generated picture, opens a gallery of every
// bunny (0 to 1336), as redactedclub.com hosts them, in one endless scroll:
// more are added as the player nears the end, and images load only as they
// come into view. A player who knows their bunny's number finds it: the
// gallery scrolls to it and outlines it. Clicking a bunny chooses it, and its
// image, https://redactedclub.com/allBunnies/<id>.webp, becomes the player's
// picture (pfp.js). No wallet is asked for: the picture is the player's choice.
//
// Its controls are webapp's own SUI components: screen buttons, the text input
// with its warning and the close link.
import {bunnyUrl, isBunny, attributes} from './pfp.js';
import {bindSubmitButtonToInput} from '../../structs-webapp/src/js/util/SubmitButtonToggle.js';
import {PfpViewerComponent} from '../../structs-webapp/src/js/view_models/components/PfpViewerComponent.js';

export const FIRST_ID = 0;
export const LAST_ID = 1336;
const BATCH = 120;
const ID_PATTERN = /^\d{1,4}$/;

/** @return {number|null} the bunny with this number, if there is one */
function parseId(text) {
  const value = String(text).trim().replace(/^#/, '');
  if (!ID_PATTERN.test(value)) return null;
  const id = Number(value);
  return id >= FIRST_ID && id <= LAST_ID ? id : null;
}

/** @return {number|null} the bunny the render attributes picture, if any */
function chosenId(pfp) {
  return isBunny(pfp?.url) ? Number(pfp.url.match(/(\d+)\.webp$/)[1]) : null;
}

/**
 * Adds "Choose bunny" to the sign-up profile screen (SetUsernameViewModel,
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
  button.className = 'sui-screen-btn sui-mod-secondary';
  button.textContent = 'Choose bunny';
  refresh.after(button);

  const picker = createPicker(body, {
    current: () => chosenId(viewModel.pfpViewerComponent?.pfp),
    say: text => menuPage.setDialogueScreenContent(text, true),
    choose: id => {
      const component = viewModel.pfpViewerComponent;
      // The generated layers stay, under the bunny, for clients that don't show URLs.
      component.pfp = {...(component.pfp ?? {}), url: bunnyUrl(id)};
      component.render();
      viewModel.gameState.signupRequest.pfp_client_render_attributes = component.getPfpJson();
      menuPage.setDialogueScreenContent(`Redacted Club #${id} it is. Now, your display name.`, true);
    },
  });
  button.addEventListener('click', picker.open);
}

/**
 * The gallery, hidden over `host` until opened: at sign-up (mount) and on the
 * player's own profile (mountProfile).
 *
 * @param {HTMLElement} host positioned element the gallery covers
 * @param {object} options
 * @param {function(): (number|null)} options.current the bunny chosen now, if any
 * @param {function(string): void} options.say shows the gallery's messages
 * @param {function(number): void} options.choose called with the chosen number
 * @param {HTMLElement} [options.viewport] the scrolling element `host` is in,
 *   when `host` may be taller than it: the gallery then ends where it does
 * @return {{open: function(): void, close: function(): void}}
 */
function createPicker(host, {current, say, choose, viewport = null}) {
  host.querySelector('.rc-bunny-picker')?.remove();
  const panel = document.createElement('div');
  panel.id = 'rc-bunny-picker';
  panel.className = 'rc-bunny-picker hidden';
  panel.innerHTML = `
    <div class="rc-bunny-picker-header">
      <span class="sui-text-header">Redacted Club</span>
      <a id="rc-bunny-close" class="sui-screen-nav-close" href="javascript: void(0)" aria-label="Close">
        <i class="sui-icon-sm icon-close"></i>
      </a>
    </div>
    <div class="common-inline-text-input-group-container">
      <div class="common-inline-text-input-controls-container">
        <label class="sui-input-text" for="rc-bunny-id">
          <span>Find by Number</span>
          <input type="text" inputmode="numeric" autocomplete="off" name="rc-bunny-id" id="rc-bunny-id" placeholder="${FIRST_ID} to ${LAST_ID}">
        </label>
        <button id="rc-bunny-id-btn" class="sui-screen-btn sui-mod-disabled" type="button" disabled>Find</button>
      </div>
      <div class="common-inline-text-input-error-container">
        <div id="rc-bunny-id-error" class="sui-input-text-warning">Enter a number from ${FIRST_ID} to ${LAST_ID}.</div>
      </div>
    </div>
    <div id="rc-bunny-scroll" class="rc-bunny-scroll">
      <div id="rc-bunny-grid" class="rc-bunny-grid"></div>
    </div>`;
  host.append(panel);

  const scroller = panel.querySelector('#rc-bunny-scroll');
  const grid = panel.querySelector('#rc-bunny-grid');
  const idInput = panel.querySelector('#rc-bunny-id');
  const idButton = panel.querySelector('#rc-bunny-id-btn');
  const idError = panel.querySelector('#rc-bunny-id-error');

  let next = FIRST_ID; // the first bunny not yet in the grid
  const tile = id => grid.querySelector(`[data-bunny="${id}"]`);

  /** Adds bunnies to the grid, the next batch or up to (and past) `id`. */
  const renderMore = (id = null) => {
    if (next > LAST_ID || (id !== null && id < next)) return;
    const last = Math.min(LAST_ID, (id ?? next) + BATCH - 1);
    const chosen = current();
    const html = [];
    for (let n = next; n <= last; n++) {
      html.push(`<button type="button" class="rc-bunny-tile${n === chosen ? ' sui-mod-active' : ''}" data-bunny="${n}" title="Redacted Club #${n}" aria-label="Redacted Club #${n}"><img src="${bunnyUrl(n)}" alt="" loading="lazy"></button>`);
    }
    grid.insertAdjacentHTML('beforeend', html.join(''));
    next = last + 1;
  };

  // The endless scroll: nearing the end of the grid adds the next batch, until
  // the grid reaches past the bottom of the view.
  const fill = () => {
    while (next <= LAST_ID && scroller.clientHeight > 0 && scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - 600) {
      renderMore();
    }
  };
  scroller.addEventListener('scroll', fill, {passive: true});

  grid.addEventListener('click', event => {
    const target = event.target.closest('.rc-bunny-tile');
    if (target) pick(Number(target.dataset.bunny));
  });

  /** Brings a bunny into view, outlined. */
  const reveal = (id, {mark = true, smooth = true} = {}) => {
    renderMore(id);
    const target = tile(id);
    if (!target) return;
    if (mark) {
      grid.querySelectorAll('.rc-mod-found').forEach(found => found.classList.remove('rc-mod-found'));
      // Restarted, so finding the same bunny again plays the highlight again.
      void target.offsetWidth;
      target.classList.add('rc-mod-found');
    }
    target.scrollIntoView({block: 'center', behavior: smooth ? 'smooth' : 'auto'});
  };

  // Within a taller page (the profile), the gallery covers what is in view.
  const fit = () => {
    if (!viewport) return;
    viewport.scrollTop = 0;
    panel.style.bottom = 'auto';
    panel.style.height = `${Math.max(0, viewport.getBoundingClientRect().bottom - host.getBoundingClientRect().top)}px`;
  };

  const open = () => {
    panel.classList.remove('hidden');
    fit();
    const chosen = current();
    grid.querySelectorAll('.rc-bunny-tile.sui-mod-active').forEach(active => active.classList.remove('sui-mod-active'));
    if (chosen !== null) {
      renderMore(chosen);
      tile(chosen)?.classList.add('sui-mod-active');
      reveal(chosen, {mark: false, smooth: false});
    }
    fill();
    say(`Pick your bunny. Know its number? Find it.`);
  };

  const close = () => panel.classList.add('hidden');

  const pick = id => {
    close();
    choose(id);
  };

  const find = () => {
    const id = parseId(idInput.value);
    if (id === null) {
      idError.classList.add('sui-mod-show');
      return;
    }
    idError.classList.remove('sui-mod-show');
    reveal(id);
    fill();
    say(`There's #${id}. Click it to make it yours.`);
  };

  bindSubmitButtonToInput(idInput, () => idButton);
  idInput.addEventListener('input', () => idError.classList.remove('sui-mod-show'));
  idInput.addEventListener('keyup', event => {
    if (event.key === 'Enter') find();
  });
  idButton.addEventListener('click', find);
  panel.querySelector('#rc-bunny-close').addEventListener('click', close);
  return {open, close};
}

/** The profile is confirmed: the picture can't change any more. */
function lock() {
  document.getElementById('rc-bunny-btn')?.remove();
  document.getElementById('rc-bunny-picker')?.remove();
}

// The player's own profile ---------------------------------------------------

const EDIT_ID = 'rc-profile-pfp-edit-btn';

/**
 * The edit button on the player's own portrait (AccountProfileViewModel).
 *
 * @param {object} viewModel AccountProfileViewModel
 * @return {string}
 */
function profileButtonHTML(viewModel) {
  return viewModel.isOwnProfile
    ? `<a id="${EDIT_ID}" class="rc-profile-pfp-edit" href="javascript: void(0)" title="Change picture" aria-label="Change picture">
        <i class="sui-icon icon-edit sui-text-secondary"></i>
      </a>`
    : '';
}

/**
 * Opens the gallery from the player's own profile; the bunny they choose is
 * set as their pfp on chain by their key at once (MsgPlayerUpdatePfp).
 *
 * @param {object} viewModel AccountProfileViewModel
 * @param {object} menuPage webapp's MenuPage
 */
function mountProfile(viewModel, menuPage) {
  const button = document.getElementById(EDIT_ID);
  const host = document.getElementById(menuPage.pageTemplateContentId);
  if (!button || !host) return;
  host.classList.add('rc-bunny-picker-host');

  const status = document.createElement('div');
  status.className = 'rc-profile-pfp-status sui-text-hint hidden';
  document.querySelector('.profile-header-info-container')?.append(status);
  const say = text => {
    status.textContent = text;
    status.classList.toggle('hidden', !text);
  };

  const picker = createPicker(host, {
    viewport: document.getElementById(menuPage.screenBodyId),
    current: () => chosenId({url: viewModel.player?.pfp}),
    say: () => {},
    choose: async id => {
      const {gameState, signingClientManager} = globalThis;
      const player = gameState?.keyPlayers?.player?.player;
      if (!player?.id || player.id !== viewModel.playerId || !signingClientManager) {
        say('Your picture can only be changed while you are signed in.');
        return;
      }
      const url = bunnyUrl(id);
      button.classList.add('sui-mod-disabled');
      say(`Setting Redacted Club #${id} as your picture…`);
      try {
        const tx = await signingClientManager.queueMsgPlayerUpdatePfp(player.id, url);
        if (tx?.status !== 'succeeded') throw new Error(tx?.error ?? tx?.status ?? 'not sent');
        player.pfp = url;
        player.pfp_client_render_attributes = attributes(url, player.pfp_client_render_attributes);
        // The HUD's portrait, and anything else showing the player's own.
        const event = new CustomEvent('RENDER_PLAYER_PFP');
        event.playerType = 'player';
        window.dispatchEvent(event);
        const portrait = document.querySelector('.profile-header-image');
        if (portrait) portrait.innerHTML = new PfpViewerComponent(player.pfp_client_render_attributes).renderHTML();
        say(`Redacted Club #${id} is your picture.`);
      } catch (error) {
        console.warn(`[rc] pfp of ${player.id} not set: ${error?.message ?? error}`);
        say(`Your picture was not changed: ${error?.message ?? error}`);
      } finally {
        button.classList.remove('sui-mod-disabled');
      }
    },
  });
  button.addEventListener('click', () => {
    if (!button.classList.contains('sui-mod-disabled')) picker.open();
  });
}

export const bunnies = Object.freeze({mount, lock, profileButtonHTML, mountProfile});
