/**
 * コンポジションルート：すべての部品をここで組み立てて接続する。
 * 各クラスは自分で依存先を new せず、ここから受け取る（依存性の注入）。
 */
import { THREE } from './lib/three.js';
import {
  CARD_SIZE, CARD_TEXTURE_SIZE, DECK_OPTIONS, ATTRACT_DECK_SIZE, TIMING, MOTION,
  FLOAT_AREA, REVEAL_LAYOUT, TABLE, CAMERA, POINTER, CPU, PILES, ARM
} from './config/GameConfig.js';
import { TEXT } from './config/strings.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY_ID, TUTORIAL_DIFFICULTY, getDifficulty } from './config/Difficulties.js';

import { GameLoop } from './core/GameLoop.js';
import { PausableClock } from './core/PausableClock.js';
import { PausableTimeline } from './core/PausableTimeline.js';
import { FisherYatesShuffler } from './domain/Shuffler.js';
import { DeckFactory } from './domain/DeckFactory.js';
import { SameRankRule } from './domain/MatchRule.js';
import { getGameMode } from './domain/GameModes.js';

import { RenderContext } from './render/RenderContext.js';
import { Lighting } from './render/environment/Lighting.js';
import { Room } from './render/environment/Room.js';
import { CasinoTable } from './render/environment/CasinoTable.js';
import { DustParticles } from './render/environment/DustParticles.js';
import { CanvasTextureFactory } from './render/textures/CanvasTextureFactory.js';
import { SuitPainter } from './render/textures/SuitPainter.js';
import { CardFacePainter } from './render/textures/CardFacePainter.js';
import { CardBackPainter } from './render/textures/CardBackPainter.js';
import { CardTextureLibrary } from './render/textures/CardTextureLibrary.js';
import { FloatLayout } from './render/cards/FloatLayout.js';
import { CardField } from './render/cards/CardField.js';
import { CardPicker } from './render/cards/CardPicker.js';
import { RevealStage } from './render/cards/RevealStage.js';
import { CardChoreographer } from './render/cards/CardChoreographer.js';
import { DriftFactory } from './render/cards/drift/DriftFactory.js';
import { AnchorTravelFactory } from './render/cards/travel/AnchorTravelFactory.js';
import { FirstPersonRig } from './render/player/FirstPersonRig.js';
import { HandModelFactory } from './render/player/HandModelFactory.js';
import { HAND_POSES } from './render/player/HandPoses.js';
import { PointingHand } from './render/player/PointingHand.js';
import { HoldingHand } from './render/player/HoldingHand.js';
import { PileFactory } from './render/piles/PileFactory.js';
import { BareArm } from './render/player/BareArm.js';
import { ArmReach } from './physics/ArmReach.js';
import { PalmContactSensor } from './physics/PalmContactSensor.js';
import { ArmCollisionResolver } from './physics/ArmCollisionResolver.js';
import { PalmHold } from './physics/PalmHold.js';
import { ArmVisibility } from './render/player/ArmVisibility.js';

import { PointerInput } from './input/PointerInput.js';
import { KeyboardInput } from './input/KeyboardInput.js';
import { KeyboardLookController } from './input/KeyboardLookController.js';
import { ReachController } from './input/ReachController.js';

import { Hud } from './ui/Hud.js';
import { Toast } from './ui/Toast.js';
import { MenuScreen } from './ui/MenuScreen.js';
import { ResultScreen } from './ui/ResultScreen.js';
import { ResultFormatter } from './ui/ResultFormatter.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { PauseScreen } from './ui/PauseScreen.js';
import { PauseButton } from './ui/PauseButton.js';
import { ReachMeter } from './ui/ReachMeter.js';
import { ReachPad } from './ui/ReachPad.js';
import { ContactIndicator } from './ui/ContactIndicator.js';
import { TutorialScreen } from './ui/TutorialScreen.js';

import { App } from './app/App.js';
import { LocalGameSession } from './app/session/LocalGameSession.js';
import { AttractMode } from './app/AttractMode.js';
import { HoverHighlighter } from './app/HoverHighlighter.js';
import { ViewportBinder } from './app/ViewportBinder.js';
import { PauseController } from './app/PauseController.js';
import { CardSelectionFactory } from './app/selection/CardSelectionMethods.js';
import { ContactFeedback } from './app/ContactFeedback.js';
import { AutomationProbe } from './app/AutomationProbe.js';
import { TutorialGuide } from './app/tutorial/TutorialGuide.js';
import { TutorialRecord } from './app/tutorial/TutorialRecord.js';
import { waitForFont } from './app/fontLoader.js';

import { ServerMessage } from './net/Protocol.js';
import { NetworkClient } from './online/NetworkClient.js';
import { ServerClock } from './online/ServerClock.js';
import { OnlineLobby } from './online/OnlineLobby.js';
import { OnlineGameSession } from './online/OnlineGameSession.js';
import { PresenceBroadcaster } from './online/PresenceBroadcaster.js';
import { PlayerIdentity } from './online/PlayerIdentity.js';
import { RoomLink } from './online/RoomLink.js';
import { isOnlineAvailable } from './online/OnlineAvailability.js';
import { RemotePlayers } from './render/player/RemotePlayers.js';
import { LobbyScreen } from './ui/LobbyScreen.js';

const $ = id => document.getElementById(id);

async function main() {
  /* ---- 3D の土台 ---- */
  const renderContext = new RenderContext($('stage'));
  const { scene } = renderContext;
  const rig = new FirstPersonRig({ scene, config: CAMERA });
  renderContext.setCamera(rig.camera);
  new ViewportBinder({ renderContext, rig }).bind();

  const textureFactory = new CanvasTextureFactory(renderContext.renderer);
  new Lighting({ scene, camera: rig.camera, table: TABLE });
  new Room({ scene, textureFactory });
  new CasinoTable({ scene, textureFactory, table: TABLE });
  const dust = new DustParticles({ scene });

  /* ---- 手（素手。腕は画面の外の肩からどこまでも続いて見える） ---- */
  // 右手は伸ばすと透かすので、左手とは別の材質で作る
  const rightHandModels = new HandModelFactory();
  const leftHandModels = new HandModelFactory();
  const rightHandModel = rightHandModels.create(HAND_POSES.point);
  const leftHandModel = leftHandModels.create(HAND_POSES.open, { mirror: true });
  const pointingHand = new PointingHand({
    camera: rig.camera,
    model: rightHandModel,
    basePosition: new THREE.Vector3(0.21, -0.25, -0.44),
    shoulderPosition: new THREE.Vector3(...ARM.shoulder)
  });
  const rightArm = new BareArm({
    camera: rig.camera, hand: pointingHand, wrist: rightHandModel.userData.wrist,
    radius: ARM.skinRadius, beyondShoulder: ARM.beyondShoulder, material: rightHandModels.materials.skin
  });
  const armVisibility = new ArmVisibility({
    hand: pointingHand,
    materials: Object.values(rightHandModels.materials),
    minOpacity: ARM.minOpacity,
    fadeOverReach: ARM.fadeOverReach
  });
  const armReach = new ArmReach(ARM);
  pointingHand.setReachProvider(() => armReach.length);
  const holdingHand = new HoldingHand({
    camera: rig.camera,
    model: leftHandModel,
    basePosition: new THREE.Vector3(-0.27, -0.28, -0.48),
    shoulderPosition: new THREE.Vector3(...ARM.leftShoulder)
  });
  const leftArm = new BareArm({
    camera: rig.camera, hand: holdingHand, wrist: leftHandModel.userData.wrist,
    radius: ARM.skinRadius, beyondShoulder: ARM.beyondShoulder, material: leftHandModels.materials.skin
  });

  /* ---- カード ---- */
  const suitPainter = new SuitPainter();
  const textures = new CardTextureLibrary({
    textureFactory,
    facePainter: new CardFacePainter({ suitPainter, ...CARD_TEXTURE_SIZE }),
    backPainter: new CardBackPainter({ suitPainter, ...CARD_TEXTURE_SIZE }),
    ...CARD_TEXTURE_SIZE
  });
  const floatLayout = new FloatLayout({ area: FLOAT_AREA });
  const field = new CardField({
    scene, textures, motion: MOTION, cardSize: CARD_SIZE,
    layout: floatLayout,
    driftFactory: new DriftFactory(),
    travelFactory: new AnchorTravelFactory({ layout: floatLayout }),
    knockDrag: ARM.knockDrag
  });
  const picker = new CardPicker({ camera: rig.camera, field });
  // E2E がカードを狙ってクリックできるよう、自動操作のときだけ出す
  if (navigator.webdriver) {
    window.__nervousBreakdownE2E = new AutomationProbe({ camera: rig.camera, field, picker, canvas: renderContext.canvas });
  }
  const choreographer = new CardChoreographer({
    stage: new RevealStage({ camera: rig.camera, layout: REVEAL_LAYOUT }),
    motion: MOTION
  });
  const pileFactory = new PileFactory({ scene, holdingHand, piles: PILES, table: TABLE });

  /* ---- ルール ---- */
  const deckFactory = new DeckFactory(new FisherYatesShuffler());
  const matchRule = new SameRankRule();

  /* ---- 入力と画面 ---- */
  const pointer = new PointerInput(renderContext.canvas, POINTER);
  const keyboard = new KeyboardInput();
  const hud = new Hud({ root: $('hud'), turnEl: $('turn'), scoresEl: $('scores'), helpEl: $('help') });
  const toast = new Toast($('toast'), { durationMs: TIMING.toastMs });
  const menu = new MenuScreen({
    root: $('menu'), startButton: $('startBtn'), tutorialButton: $('tutorialBtn'),
    defaults: { modeId: 'solo', difficultyId: DEFAULT_DIFFICULTY_ID, deckSize: 32 }
  });
  const result = new ResultScreen({
    root: $('result'), eyebrowEl: $('resEyebrow'), titleEl: $('resTitle'), statsEl: $('resStats'),
    againButton: $('againBtn'), menuButton: $('menuBtn')
  });

  /* ---- ゲーム内時計とポーズ ---- */
  const gameClock = new PausableClock();
  const pauseScreen = new PauseScreen({ root: $('pause'), resumeButton: $('resumeBtn'), quitButton: $('quitBtn'), noteEl: $('pauseNote') });
  const pauseButton = new PauseButton($('pauseBtn'));
  const reachMeter = new ReachMeter({ root: $('reachMeter'), fill: $('reachFill') });
  // 達人・極の操作ボタンは、タッチが主な端末（マウスで指せない）だけで出す
  const reachPad = new ReachPad({
    root: $('reachPad'), extendButton: $('reachExtend'), retractButton: $('reachRetract'), flipButton: $('reachFlip'),
    enabled: window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false
  });

  /* ---- 達人モード：手のひらの接触（app は後で作るので、判定は関数で遅延参照する） ---- */
  let app = null;
  const contactSensor = new PalmContactSensor({
    arm: pointingHand, field, palmRadius: ARM.palmRadius,
    isEnabled: () => app?.canReach() ?? false
  });
  const pause = new PauseController({ clock: gameClock, screen: pauseScreen, button: pauseButton });

  /* ---- オンライン対戦 ---- */
  const network = new NetworkClient();
  const serverClock = new ServerClock();
  network.on(ServerMessage.Pong, sample => serverClock.addSample(sample));
  const remotePlayers = new RemotePlayers({ scene, camera: rig.camera });
  const roomLink = new RoomLink();
  const lobby = new OnlineLobby({
    network,
    identity: new PlayerIdentity(),
    link: roomLink,
    screen: new LobbyScreen({
      root: $('lobby'),
      els: {
        form: $('lobbyForm'), formView: $('lobbyFormView'), formTitle: $('lobbyFormTitle'), nameInput: $('lobbyName'),
        submitBtn: $('lobbySubmit'), backBtn: $('lobbyBack'), error: $('lobbyError'),
        roomView: $('lobbyRoomView'), roomCode: $('lobbyCode'), inviteInput: $('lobbyInvite'), copyBtn: $('lobbyCopy'),
        settings: $('lobbySettings'), players: $('lobbyPlayers'), waitNote: $('lobbyNote'),
        startBtn: $('lobbyStart'), leaveBtn: $('lobbyLeave')
      }
    })
  });
  const onlineServices = {
    network, serverClock, remotePlayers,
    presence: new PresenceBroadcaster({ network, camera: rig.camera, pointer, reach: armReach })
  };

  /* ---- アプリ ---- */
  const sessionServices = {
    deckFactory, deckOptions: DECK_OPTIONS, matchRule, field, picker, choreographer,
    pileFactory, hud, toast, timing: TIMING, cpuConfig: CPU, clock: gameClock,
    reachMeter, reachPad, selectionFactory: new CardSelectionFactory({ picker, contactSensor })
  };
  app = new App({
    menu, result, toast, strings: TEXT, pointer, keyboard, reachPad, rig, pointingHand,
    pauseScreen, pauseButton, pause, lobby, roomLink,
    loading: new LoadingScreen($('loading')),
    resultFormatter: new ResultFormatter(),
    attract: new AttractMode({
      field, deckFactory, maxRank: DECK_OPTIONS[ATTRACT_DECK_SIZE], difficulty: DIFFICULTIES.normal
    }),
    createLocalSession: ({ modeId, difficultyId, deckSize }) => new LocalGameSession({
      mode: getGameMode(modeId),
      difficulty: getDifficulty(difficultyId),
      deckSize,
      services: sessionServices
    }),
    createOnlineSession: start => new OnlineGameSession({ start, services: sessionServices, online: onlineServices }),
    tutorialScreen: new TutorialScreen({
      root: $('tutorial'), textEl: $('tutorialText'), progressEl: $('tutorialProgress'),
      skipButton: $('tutorialSkip'), finishButton: $('tutorialFinish')
    }),
    tutorialGuide: new TutorialGuide(),
    tutorialRecord: new TutorialRecord(),
    createTutorialSession: () => new LocalGameSession({
      mode: getGameMode('tutorial'),
      difficulty: TUTORIAL_DIFFICULTY,
      services: sessionServices
    })
  });

  /* ---- フレームループ（登録順に更新される） ----
   * gameplay の中身はゲーム内時計で動くのでポーズで止まる。
   * 視点・手・描画は止めない（ポーズ画面の背景も描き続ける）。 */
  const gameplay = new PausableTimeline(gameClock)
    .add(new ReachController({ inputs: [keyboard, reachPad], reach: armReach, meter: reachMeter, isEnabled: () => app.canReach() }))
    .add(contactSensor)
    .add(new PalmHold({ sensor: contactSensor, isEnabled: () => app.canHoldTouched() }))
    .add(new ArmCollisionResolver({
      arm: pointingHand, field, config: ARM,
      isEnabled: () => app.canReach(),
      isExempt: view => view === contactSensor.current,
      onKnock: (view, impulse, spin) => app.reportKnock(view, impulse, spin)
    }))
    .add(new ContactFeedback({
      sensor: contactSensor,
      indicator: new ContactIndicator($('contactHint')),
      isActive: () => app.canHumanAct()
    }))
    .add(field)
    .add(dust)
    .add(app);
  new GameLoop()
    .add(rig)
    .add(new KeyboardLookController({ keyboard, rig }))
    .add(new HoverHighlighter({ pointer, picker, field, isEnabled: () => app.canHover(), cursorTarget: renderContext.canvas }))
    .add(gameplay)
    .add(pointingHand)
    .add(rightArm)
    .add(armVisibility)
    .add(holdingHand)
    .add(leftArm)
    .add(remotePlayers)
    .add(renderContext)
    .start();

  const [onlineAvailable] = await Promise.all([
    isOnlineAvailable(),
    waitForFont('800 92px "Shippori Mincho B1"', 'AJQK', 1800)
  ]);
  textures.invalidateFaces();
  app.boot({ onlineAvailable });
}

main().catch(err => {
  console.error(err);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = `起動できませんでした：${err.message}`;
});
