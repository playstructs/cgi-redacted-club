// Changes to structs-webapp's sources, as [exact upstream text, replacement]
// pairs per upstream file (rc/overlay.cjs applies them).
//
// structs-webapp is served by its guild and reaches the guild API at /api,
// with a session cookie, and GRASS and the chain node on the same host. This
// page (structs.redactedclub.com) hosts none of them: these patches send webapp to
// Redacted Club's (0-10) services, as rc/runtime/guild.js reads them, with a
// bearer token instead of the cookie. The rest puts Redacted Club where webapp's
// sign-up and tutorial name SN Corp.

const GUILD = 'Redacted Club';
const GUILD_CAPS = 'REDACTED CLUB';
const TAG = 'RC';

// The nav label of every sign-up and orientation screen.
const navLabel = [["'SN.Corporation'", `'${GUILD}'`]];

// The signup logo: Redacted Club's badge and motto in SN Corp's 192px slot.
const logo = [
  ['src="/img/logo-snc.gif"', 'src="/rc/img/redacted-club-badge.png"'],
  ['alt="SNC logo"', `alt="${GUILD} logo"`],
  ['>WE KNOW BETTER.</h2>', '>DWTLK</h2>'],
];

const guildApi = path => `Object.defineProperty(this, 'apiUrl', {get: () => \`\${__rc.guild.api}${path}\`, enumerable: true});`;

module.exports = {
  'js/index.js': [
    // Nothing below may run before the guild, and so its services, is known.
    // The tutorial is a simulation and needs no guild.
    ['const tutorialMode = TutorialMode.isActive();', 'if (!TutorialMode.isActive()) await __rc.guild.ready;\nconst tutorialMode = TutorialMode.isActive();'],
    ['`ws://${window.location.hostname}:1443`', '(__rc.guild.grass || `ws://${window.location.hostname}:1443`)'],
  ],
  'js/managers/SigningClientManager.js': [
    [': `ws://${window.location.hostname}:26657`)', ': (__rc.guild.chainWs || `ws://${window.location.hostname}:26657`))'],
    // Under the current protocol the signing queue only sends a player's own
    // messages built from a gameplay intent; a plain queued message is refused
    // ("Queued intent requires current-protocol preparation"). Upstream moved
    // MsgPlayerUpdateName there but not MsgPlayerUpdatePfp, which sets a
    // sign-up bunny as the player's pfp (rc/runtime/pfp.js).
    [
      "const id = this.queue.enqueueImmediate(\n      '/structs.structs.MsgPlayerUpdatePfp',",
      "const id = this.queue.enqueueGameplayImmediate(\n      '/structs.structs.MsgPlayerUpdatePfp',",
    ],
  ],
  'js/util/GameplayIntent.js': [
    // Like the name, a player's own pfp: the native handler, exercised by the
    // signed simulation, checks the signer's authority over the player.
    [
      "  '/structs.structs.MsgPlayerUpdateName': null,\n",
      "  '/structs.structs.MsgPlayerUpdateName': null,\n  '/structs.structs.MsgPlayerUpdatePfp': null,\n",
    ],
  ],
  'js/api/GuildAPI.js': [
    ["this.apiUrl = '/api';", guildApi('')],
    // This page's guild is fixed (0-10), never looked up: /guild/this is the
    // API host's own guild, and Redacted Club shares SN Corp's API.
    ['`${this.apiUrl}/guild/this`', '`${this.apiUrl}/guild/${__rc.guild.id}`'],
    // /auth/token takes the same signed login as /auth/login and answers with a bearer token.
    [
      'const jsonResponse = await this.ajax.post(`${this.apiUrl}/auth/login`, loginRequestDTO, {...options, reauthenticate: false});',
      'const jsonResponse = await this.ajax.post(`${this.apiUrl}/auth/token`, loginRequestDTO, {...options, reauthenticate: false});\n'
      + '    __rc.guild.setToken(jsonResponse?.success ? jsonResponse.data?.access_token : null);',
    ],
    [
      'const jsonResponse = await this.ajax.post(`${this.apiUrl}/auth/logout`, {}, options);',
      'const jsonResponse = await this.ajax.post(`${this.apiUrl}/auth/logout`, {}, options);\n    __rc.guild.setToken(null);',
    ],
  ],
  'js/framework/JsonAjaxer.js': [
    ["headers: {\n        'Content-Type': 'application/json'\n      },", "headers: {\n        'Content-Type': 'application/json',\n        ...__rc.guild.headers()\n      },"],
  ],
  'js/managers/AuthManager.js': [
    // Before any guild API call, recovery checks on chain that the player is in
    // this guild, moving them here from another guild, and stops if they are
    // not: a shared guild API may log in another guild's player (recovery.js).
    [
      'import {MenuPage} from "../framework/MenuPage";',
      'import {MenuPage} from "../framework/MenuPage";\nimport {MenuWaitingViewModel} from "../view_models/generic/MenuWaitingViewModel";',
    ],
    [
      'const primaryAddress = this.gameState.signingAccount.address;\n    const guildId = this.gameState.thisGuild.id;',
      'const primaryAddress = this.gameState.signingAccount.address;\n'
      + '    if (!await __rc.recovery.ensureInThisGuild(this, primaryAddress, signal, MenuWaitingViewModel.setMessage)) return false;\n'
      + '    const guildId = this.gameState.thisGuild.id;',
    ],
  ],
  'js/telemetry/OnboardingTelemetry.js': [
    // Onboarding and tutorial runs are reported under this interface's own
    // name. Guilds take a slug here (RegexPattern::SLUG), which allows the dots.
    ["ONBOARDING_INTERFACE_NAME = 'structs-webapp'", "ONBOARDING_INTERFACE_NAME = 'structs.redactedclub.com'"],
    ['fetch(ENDPOINT, {', 'fetch(`${__rc.guild.api}/onboarding/events`, {'],
    ['navigator.sendBeacon(ENDPOINT, body)', 'navigator.sendBeacon(`${__rc.guild.api}/onboarding/events`, body)'],
  ],
  // Like GuildAPI's: these APIs live on the guild, not on this page's host.
  'js/api/InfluenceAPI.js': [
    ["this.apiUrl = '/api/influence';", guildApi('/influence')],
  ],
  // Spectating a Sector Blitz raid (/?spectate=<planet>) reads the public raid snapshot.
  'js/api/PublicSectorBlitzAPI.js': [
    ["this.apiUrl = '/api/public/sector-blitz';", guildApi('/public/sector-blitz')],
  ],

  // Players' own pictures (rc/runtime/pfp.js): every portrait shows a player's
  // pfp URL, over webapp's generated layers, which remain the fallback. The URL
  // rides in the render attributes, which every portrait already receives.
  'js/models/PfpClientRenderAttributes.js': [
    ['    return new PfpClientRenderAttributes(\n      obj.head ?? null,', '    return __rc.pfp.keepUrl(obj, new PfpClientRenderAttributes(\n      obj.head ?? null,'],
    ['      obj.background ?? null\n    );', '      obj.background ?? null\n    ));'],
  ],
  'js/factories/PlayerFactory.js': [
    ['player.pfp_client_render_attributes = PfpClientRenderAttributes.fromJson(player.pfp_client_render_attributes);',
      'player.pfp_client_render_attributes = __rc.pfp.attributes(player.pfp, PfpClientRenderAttributes.fromJson(player.pfp_client_render_attributes));'],
  ],
  'js/factories/PlayerSearchResultDTOFactory.js': [
    ['player.pfp_client_render_attributes = PfpClientRenderAttributes.fromJson(player.pfp_client_render_attributes);',
      'player.pfp_client_render_attributes = __rc.pfp.attributes(player.pfp, PfpClientRenderAttributes.fromJson(player.pfp_client_render_attributes));'],
  ],
  'js/view_models/login/ActivateDeviceVerifyViewModel.js': [
    ['PfpClientRenderAttributes.fromJson(this.activationCodeInfo.pfp_client_render_attributes)',
      '__rc.pfp.attributes(this.activationCodeInfo.pfp, PfpClientRenderAttributes.fromJson(this.activationCodeInfo.pfp_client_render_attributes))'],
  ],
  'js/view_models/components/PfpViewerComponent.js': [
    ['  renderHTML() {\n    if (!this.pfp) {', '  renderHTML() {\n    return __rc.pfp.html(this.pfp, this.renderLayersHTML());\n  }\n\n  renderLayersHTML() {\n    if (!this.pfp) {'],
  ],
  // Sign-up: "Choose bunny" beside the generated picture (rc/runtime/bunnies.js).
  'js/view_models/signup/SetUsernameViewModel.js': [
    ...navLabel,
    ['    this.initPfp();\n', '    this.initPfp();\n    __rc.bunnies.mount(this, MenuPage);\n'],
    ['    regeneratePfpBtn.disabled = true;\n', '    regeneratePfpBtn.disabled = true;\n    __rc.bunnies.lock();\n'],
  ],

  // Redacted Club in place of SN Corp.
  'templates/game/index.html.twig': [
    ['{% block title %}Structs{% endblock %}', `{% block title %}${GUILD} | Structs{% endblock %}`],
  ],
  'js/tutorial/TutorialCopy.js': [
    ['`SN.CORP certifies that you now meet', `\`${GUILD_CAPS} certifies that you now meet`],
  ],
  'js/tutorial/TutorialWorld.js': [
    ["name: 'SN.Corporation',", `name: '${GUILD}',`],
    ["tag: 'SNC',", `tag: '${TAG}',`],
  ],
  'js/view_models/tutorial/TutorialStatusViewModel.js': [
    ["'Computer connecting to SN.C'", `'Computer connecting to ${GUILD}'`],
  ],
  'js/view_models/login/LoggingInViewModel.js': [
    ['alt="Computer connecting to SN.C"', `alt="Computer connecting to ${GUILD}"`],
  ],
  'js/view_models/signup/ConnectingToCorp2ViewModel.js': [...navLabel, ...logo],
  'js/view_models/signup/Orientation1ViewModel.js': [
    ...navLabel,
    ['>SN.CORPORATION</span>', `>${GUILD_CAPS}</span>`],
  ],
  'js/view_models/signup/Orientation2ViewModel.js': [
    ...navLabel,
    ...logo,
    ['`You have been contracted by SN.CORPORATION, a member of the', `\`You have been contracted by ${GUILD_CAPS}, a member of the`],
  ],
  'js/view_models/signup/Orientation3ViewModel.js': navLabel,
  'js/view_models/signup/Orientation4ViewModel.js': [
    ...navLabel,
    ['data-sui-tooltip="SN.CORP accepts no responsibility', `data-sui-tooltip="${GUILD_CAPS} accepts no responsibility`],
  ],
  'js/view_models/signup/Orientation5ViewModel.js': navLabel,
  'js/view_models/signup/Orientation7ViewModel.js': [
    ...navLabel,
    ['harvest Alpha Matter on behalf of SN.CORPORATION.`', `harvest Alpha Matter on behalf of ${GUILD_CAPS}.\``],
  ],
  'js/view_models/signup/Orientation8ViewModel.js': navLabel,
  'js/view_models/signup/OrientationEndViewModel.js': [
    ...navLabel,
    ['frontier regions, SN.CORP recommends', `frontier regions, ${GUILD_CAPS} recommends`],
  ],
  'js/view_models/signup/IncomingCall3ViewModel.js': [
    ['`<strong>SN.CORP:</strong> Greetings, SN.CORPORATION employee.', `\`<strong>${GUILD_CAPS}:</strong> Greetings, ${GUILD_CAPS} employee.`],
  ],
  'js/view_models/templates/OrientationStructDeployedTemplate.js': navLabel,
  'js/view_models/templates/HRBotTalkingTemplate.js': navLabel,
};
