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
import {bunnyUrl, isBunny} from './pfp.js';
import {bindSubmitButtonToInput} from '../../structs-webapp/src/js/util/SubmitButtonToggle.js';

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
  body.append(panel);

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
    const chosen = chosenId(viewModel.pfpViewerComponent?.pfp);
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
    if (target) choose(Number(target.dataset.bunny));
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

  const open = () => {
    panel.classList.remove('hidden');
    const chosen = chosenId(viewModel.pfpViewerComponent?.pfp);
    grid.querySelectorAll('.rc-bunny-tile.sui-mod-active').forEach(active => active.classList.remove('sui-mod-active'));
    if (chosen !== null) {
      renderMore(chosen);
      tile(chosen)?.classList.add('sui-mod-active');
      reveal(chosen, {mark: false, smooth: false});
    }
    fill();
    menuPage.setDialogueScreenContent(`Pick your bunny. Know its number? Find it.`, true);
  };

  const close = () => panel.classList.add('hidden');

  const choose = id => {
    const component = viewModel.pfpViewerComponent;
    // The generated layers stay, under the bunny, for clients that don't show URLs.
    component.pfp = {...(component.pfp ?? {}), url: bunnyUrl(id)};
    component.render();
    viewModel.gameState.signupRequest.pfp_client_render_attributes = component.getPfpJson();
    close();
    menuPage.setDialogueScreenContent(`Redacted Club #${id} it is. Now, your display name.`, true);
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
    menuPage.setDialogueScreenContent(`There's #${id}. Click it to make it yours.`, true);
  };

  bindSubmitButtonToInput(idInput, () => idButton);
  idInput.addEventListener('input', () => idError.classList.remove('sui-mod-show'));
  idInput.addEventListener('keyup', event => {
    if (event.key === 'Enter') find();
  });
  idButton.addEventListener('click', find);
  panel.querySelector('#rc-bunny-close').addEventListener('click', close);
  button.addEventListener('click', open);
}

/** The profile is confirmed: the picture can't change any more. */
function lock() {
  document.getElementById('rc-bunny-btn')?.remove();
  document.getElementById('rc-bunny-picker')?.remove();
}

export const bunnies = Object.freeze({mount, lock});
