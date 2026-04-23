type InstrumentId =
  | "kick"
  | "snare"
  | "hihatClosed"
  | "hihatOpen"
  | "tomHigh"
  | "tomLow"
  | "clap"
  | "shaker"
  | "tambourine"
  | "cowbell"
  | "agogoHigh"
  | "agogoLow"
  | "congaOpen"
  | "congaSlap"
  | "surdo"
  | "pandeiro"
  | "timbal"
  | "repinique"
  | "caixa"
  | "ganza"
  | "triangle"
  | "recoReco"
  | "clave"
  | "woodBlock";

type PatternFamily =
  | "balada"
  | "rock1"
  | "rock2"
  | "rock3"
  | "rock4"
  | "jazz1"
  | "jazz2"
  | "jazz3"
  | "jazz4"
  | "axe"
  | "angola"
  | "arrastape"
  | "arrocha"
  | "aguere"
  | "bachata"
  | "baiao"
  | "batuque"
  | "boiBumba"
  | "bolero"
  | "bossa"
  | "coco"
  | "caboclinho"
  | "cabula"
  | "carimbeo"
  | "capoeira"
  | "cavaloMarinho"
  | "chacarera"
  | "chamame"
  | "ciranda"
  | "congoDeOuro"
  | "fandango"
  | "forro"
  | "frevo"
  | "ijexa"
  | "ilu"
  | "jongo"
  | "maracatu"
  | "maxixe"
  | "pagode"
  | "partidoAlto"
  | "pisadinha"
  | "popRock"
  | "reggae"
  | "samba"
  | "sambaEnredo"
  | "sambaCancao"
  | "sambaDeRoda"
  | "sambaRock"
  | "valsa"
  | "vaneirao"
  | "sertanejo"
  | "xaxado";

interface InstrumentDefinition {
  id: InstrumentId;
  name: string;
  group: string;
  description: string;
  play: (context: AudioContext, time: number, velocity: number) => void;
}

interface TrackState {
  instrumentId: InstrumentId;
  collectionId: SampleCollectionId;
  volume: number;
  mute: boolean;
  solo: boolean;
  steps: boolean[];
}

type SampleCollectionId = "synth" | "openSamples";
const DEFAULT_COLLECTION: SampleCollectionId = "openSamples";

interface PresetTemplate {
  id: string;
  name: string;
  family: PatternFamily;
  bpm: number;
  numerator: number;
  denominator: number;
  description: string;
}

interface CustomPreset {
  id: string;
  name: string;
  bpm: number;
  numerator: number;
  denominator: number;
  tracks: TrackState[];
}

interface AppState {
  bpm: number;
  numerator: number;
  denominator: number;
  tracks: TrackState[];
  currentStep: number;
  isPlaying: boolean;
  selectedPresetId: string | null;
  presetName: string;
  entryMode: EntryModeId;
}

type EntryModeId = "quarter" | "eighth" | "sixteenth" | "dottedEighth" | "rest";

const ENTRY_MODES: Array<{ id: EntryModeId; label: string; title: string }> = [
  { id: "quarter", label: "♩", title: "Seminima" },
  { id: "eighth", label: "♪", title: "Colcheia" },
  { id: "sixteenth", label: "♬", title: "Semicolcheia" },
  { id: "dottedEighth", label: "♪.", title: "Colcheia pontuada" },
  { id: "rest", label: "𝄽", title: "Pausa" },
];

const STORAGE_KEY = "batucada.customPresets.v1";
const STEPS_PER_BEAT = 4;
const MIN_BPM = 45;
const MAX_BPM = 220;
const AVAILABLE_SIGNATURE_DENOMINATORS = [2, 4, 8, 16];
const DEFAULT_INSTRUMENTS: InstrumentId[] = [
  "kick",
  "snare",
  "hihatClosed",
  "hihatOpen",
  "surdo",
  "pandeiro",
];
const SAMPLE_COLLECTIONS: Array<{ id: SampleCollectionId; label: string }> = [
  { id: "synth", label: "Synth" },
  { id: "openSamples", label: "Open Samples" },
];

let audioContext: AudioContext | null = null;
let transportTimer: number | null = null;
let presetRailScrollLeft = 0;
let activeStepButtons: HTMLElement[] = [];
let appRoot!: HTMLDivElement;
let isBound = false;
const sampleBufferCache = new Map<string, AudioBuffer>();
const sampleLoadInFlight = new Map<string, Promise<AudioBuffer | null>>();

const OPEN_SAMPLE_MAP: Partial<Record<InstrumentId, string>> = {
  kick: "/samples/open-samples/kick.wav",
  snare: "/samples/open-samples/snare.wav",
  hihatClosed: "/samples/open-samples/hihat-closed.wav",
  hihatOpen: "/samples/open-samples/hihat-open.wav",
  tomHigh: "/samples/open-samples/tom-high.wav",
  tomLow: "/samples/open-samples/tom-low.wav",
  clap: "/samples/open-samples/clap.wav",
};

const instrumentLibrary: InstrumentDefinition[] = [
  {
    id: "kick",
    name: "Kick",
    group: "Bateria",
    description: "Grave firme para marcar a pulsacao.",
    play: (context, time, velocity) => playKick(context, time, velocity),
  },
  {
    id: "snare",
    name: "Snare",
    group: "Bateria",
    description: "Ataque seco de caixa.",
    play: (context, time, velocity) => playSnare(context, time, velocity),
  },
  {
    id: "hihatClosed",
    name: "Hi-Hat fechado",
    group: "Bateria",
    description: "Pulso fechado e constante.",
    play: (context, time, velocity) => playClosedHat(context, time, velocity),
  },
  {
    id: "hihatOpen",
    name: "Hi-Hat aberto",
    group: "Bateria",
    description: "Abertura brilhante para acentos.",
    play: (context, time, velocity) => playOpenHat(context, time, velocity),
  },
  {
    id: "tomHigh",
    name: "Tom agudo",
    group: "Bateria",
    description: "Tom agudo para viradas.",
    play: (context, time, velocity) => playTom(context, time, velocity, 195),
  },
  {
    id: "tomLow",
    name: "Tom grave",
    group: "Bateria",
    description: "Tom grave encorpado.",
    play: (context, time, velocity) => playTom(context, time, velocity, 118),
  },
  {
    id: "clap",
    name: "Clap",
    group: "Bateria",
    description: "Palma sintetica curta.",
    play: (context, time, velocity) => playClap(context, time, velocity),
  },
  {
    id: "shaker",
    name: "Shaker",
    group: "Acessorios",
    description: "Textura leve e continua.",
    play: (context, time, velocity) => playShaker(context, time, velocity),
  },
  {
    id: "tambourine",
    name: "Tamborim",
    group: "Percussao brasileira",
    description: "Ataque brilhante e cortante.",
    play: (context, time, velocity) => playTambourine(context, time, velocity),
  },
  {
    id: "cowbell",
    name: "Cowbell",
    group: "Metais",
    description: "Sino metalico marcado.",
    play: (context, time, velocity) => playCowbell(context, time, velocity),
  },
  {
    id: "agogoHigh",
    name: "Agogo agudo",
    group: "Metais",
    description: "Agogo brilhante.",
    play: (context, time, velocity) => playAgogo(context, time, velocity, 890),
  },
  {
    id: "agogoLow",
    name: "Agogo grave",
    group: "Metais",
    description: "Agogo mais grave para resposta.",
    play: (context, time, velocity) => playAgogo(context, time, velocity, 620),
  },
  {
    id: "congaOpen",
    name: "Conga aberta",
    group: "Peles",
    description: "Som aberto e redondo.",
    play: (context, time, velocity) => playConga(context, time, velocity, 220),
  },
  {
    id: "congaSlap",
    name: "Conga slap",
    group: "Peles",
    description: "Ataque estalado e curto.",
    play: (context, time, velocity) => playConga(context, time, velocity, 300),
  },
  {
    id: "surdo",
    name: "Surdo",
    group: "Percussao brasileira",
    description: "Base grave para escolas e blocos.",
    play: (context, time, velocity) => playSurdo(context, time, velocity),
  },
  {
    id: "pandeiro",
    name: "Pandeiro",
    group: "Percussao brasileira",
    description: "Pulso brasileiro com brilho e pele.",
    play: (context, time, velocity) => playPandeiro(context, time, velocity),
  },
  {
    id: "timbal",
    name: "Timbal",
    group: "Percussao brasileira",
    description: "Ataque agudo e agressivo.",
    play: (context, time, velocity) => playTimbal(context, time, velocity),
  },
  {
    id: "repinique",
    name: "Repinique",
    group: "Percussao brasileira",
    description: "Chamadas e respostas.",
    play: (context, time, velocity) => playRepinique(context, time, velocity),
  },
  {
    id: "caixa",
    name: "Caixa",
    group: "Percussao brasileira",
    description: "Esteira seca e presente.",
    play: (context, time, velocity) => playCaixa(context, time, velocity),
  },
  {
    id: "ganza",
    name: "Ganza",
    group: "Acessorios",
    description: "Textura de chocalho continuo.",
    play: (context, time, velocity) => playGanza(context, time, velocity),
  },
  {
    id: "triangle",
    name: "Triangulo",
    group: "Metais",
    description: "Brilho nordestino e cortante.",
    play: (context, time, velocity) => playTriangle(context, time, velocity),
  },
  {
    id: "recoReco",
    name: "Reco-reco",
    group: "Madeiras",
    description: "Ranhura ritmica raspada.",
    play: (context, time, velocity) => playRecoReco(context, time, velocity),
  },
  {
    id: "clave",
    name: "Clave",
    group: "Madeiras",
    description: "Clave curta e seca.",
    play: (context, time, velocity) => playClave(context, time, velocity),
  },
  {
    id: "woodBlock",
    name: "Wood block",
    group: "Madeiras",
    description: "Bloco de madeira encorpado.",
    play: (context, time, velocity) => playWoodBlock(context, time, velocity),
  },
];

const instrumentMap = new Map(instrumentLibrary.map((instrument) => [instrument.id, instrument]));

const factoryPresetTemplates: PresetTemplate[] = [
  {
    id: "balada",
    name: "Balada",
    family: "balada",
    bpm: 76,
    numerator: 4,
    denominator: 4,
    description: "Pulso reto e espaco para voz.",
  },
  {
    id: "rock-classico",
    name: "Rock Classico",
    family: "rock1",
    bpm: 112,
    numerator: 4,
    denominator: 4,
    description: "Backbeat reto, chimbal constante.",
  },
  {
    id: "rock-pesado",
    name: "Rock Pesado",
    family: "rock2",
    bpm: 132,
    numerator: 4,
    denominator: 4,
    description: "Mais kick e caixa acentuada.",
  },
  {
    id: "rock-shuffle",
    name: "Rock Shuffle",
    family: "rock3",
    bpm: 118,
    numerator: 4,
    denominator: 4,
    description: "Leve arrasto com ghost notes.",
  },
  {
    id: "rock-alt",
    name: "Rock Alternativo",
    family: "rock4",
    bpm: 124,
    numerator: 4,
    denominator: 4,
    description: "Abre o hi-hat e cria respiro.",
  },
  {
    id: "jazz-brush",
    name: "Jazz Swing",
    family: "jazz1",
    bpm: 144,
    numerator: 4,
    denominator: 4,
    description: "Ride sincopado e caixa leve.",
  },
  {
    id: "jazz-bop",
    name: "Jazz Bop",
    family: "jazz2",
    bpm: 168,
    numerator: 4,
    denominator: 4,
    description: "Mais walking e resposta nos tons.",
  },
  {
    id: "jazz-waltz",
    name: "Jazz Waltz",
    family: "jazz3",
    bpm: 138,
    numerator: 3,
    denominator: 4,
    description: "Valso com conduccao de jazz.",
  },
  {
    id: "jazz-latin",
    name: "Jazz Latin",
    family: "jazz4",
    bpm: 152,
    numerator: 4,
    denominator: 4,
    description: "Mistura cowbell, congas e resposta sincopada.",
  },
  {
    id: "axe",
    name: "Axe",
    family: "axe",
    bpm: 116,
    numerator: 4,
    denominator: 4,
    description: "Timbal, surdo e caixa empurrando.",
  },
  {
    id: "angola",
    name: "Angola",
    family: "angola",
    bpm: 92,
    numerator: 4,
    denominator: 4,
    description: "Groove circular para capoeira angola.",
  },
  {
    id: "arrastape",
    name: "Arrastape",
    family: "arrastape",
    bpm: 124,
    numerator: 4,
    denominator: 4,
    description: "Forca no triangulo e zabumba sintetica.",
  },
  {
    id: "arrocha",
    name: "Arrocha",
    family: "arrocha",
    bpm: 84,
    numerator: 4,
    denominator: 4,
    description: "Pulso lento com caixa marcada.",
  },
  {
    id: "aguere",
    name: "Aguere",
    family: "aguere",
    bpm: 110,
    numerator: 4,
    denominator: 4,
    description: "Chamadas de agogo com base de timbal.",
  },
  {
    id: "bachata",
    name: "Bachata",
    family: "bachata",
    bpm: 128,
    numerator: 4,
    denominator: 4,
    description: "Clave e bongo sintetico em subdivisao.",
  },
  {
    id: "baiao",
    name: "Baiao",
    family: "baiao",
    bpm: 126,
    numerator: 2,
    denominator: 4,
    description: "Triangulo guiando e grave alternado.",
  },
  {
    id: "batuque",
    name: "Batuque",
    family: "batuque",
    bpm: 104,
    numerator: 4,
    denominator: 4,
    description: "Peles e madeiras em resposta.",
  },
  {
    id: "boi-bumba",
    name: "Boi Bumba",
    family: "boiBumba",
    bpm: 116,
    numerator: 4,
    denominator: 4,
    description: "Marcacao ampla e celebrativa.",
  },
  {
    id: "bolero",
    name: "Bolero",
    family: "bolero",
    bpm: 76,
    numerator: 4,
    denominator: 4,
    description: "Pulse lento com acento romantico.",
  },
  {
    id: "bossa",
    name: "Bossa Nova",
    family: "bossa",
    bpm: 132,
    numerator: 4,
    denominator: 4,
    description: "Pandeiro, clave e kick leve.",
  },
  {
    id: "coco",
    name: "Coco",
    family: "coco",
    bpm: 122,
    numerator: 4,
    denominator: 4,
    description: "Resposta repetitiva e contagiante.",
  },
  {
    id: "caboclinho",
    name: "Caboclinho",
    family: "caboclinho",
    bpm: 152,
    numerator: 4,
    denominator: 4,
    description: "Agilidade de caixa e agogo.",
  },
  {
    id: "cabula",
    name: "Cabula",
    family: "cabula",
    bpm: 96,
    numerator: 4,
    denominator: 4,
    description: "Pulso cerimonial, mais espacado.",
  },
  {
    id: "carimbeo",
    name: "Carimbeo",
    family: "carimbeo",
    bpm: 118,
    numerator: 4,
    denominator: 4,
    description: "Shaker vivo e resposta de tambores.",
  },
  {
    id: "capoeira",
    name: "Capoeira",
    family: "capoeira",
    bpm: 106,
    numerator: 4,
    denominator: 4,
    description: "Berimbau nao esta aqui, mas o pulso sim.",
  },
  {
    id: "cavalo-marinho",
    name: "Cavalo-Marinho",
    family: "cavaloMarinho",
    bpm: 128,
    numerator: 4,
    denominator: 4,
    description: "Passo saltado com caixa curta.",
  },
  {
    id: "chacarera",
    name: "Chacarera",
    family: "chacarera",
    bpm: 118,
    numerator: 6,
    denominator: 8,
    description: "Compasso composto com pulsacao folclorica.",
  },
  {
    id: "chamame",
    name: "Chamame",
    family: "chamame",
    bpm: 112,
    numerator: 4,
    denominator: 4,
    description: "Pulso de danca rural.",
  },
  {
    id: "ciranda",
    name: "Ciranda",
    family: "ciranda",
    bpm: 92,
    numerator: 4,
    denominator: 4,
    description: "Circular e bem marcado.",
  },
  {
    id: "congo-de-ouro",
    name: "Congo de Ouro",
    family: "congoDeOuro",
    bpm: 108,
    numerator: 4,
    denominator: 4,
    description: "Marcacao grave com resposta metalica.",
  },
  {
    id: "fandango",
    name: "Fandango",
    family: "fandango",
    bpm: 132,
    numerator: 3,
    denominator: 4,
    description: "Danca acelerada em tres.",
  },
  {
    id: "forro",
    name: "Forro",
    family: "forro",
    bpm: 128,
    numerator: 4,
    denominator: 4,
    description: "Triangulo e zabumba sintetica.",
  },
  {
    id: "frevo",
    name: "Frevo",
    family: "frevo",
    bpm: 164,
    numerator: 2,
    denominator: 4,
    description: "Ataque rapido e cheio.",
  },
  {
    id: "ijexa",
    name: "Ijexa",
    family: "ijexa",
    bpm: 104,
    numerator: 4,
    denominator: 4,
    description: "Balanco afro-brasileiro.",
  },
  {
    id: "ilu",
    name: "Ilu",
    family: "ilu",
    bpm: 108,
    numerator: 4,
    denominator: 4,
    description: "Peles dialogando em acentos cruzados.",
  },
  {
    id: "jongo",
    name: "Jongo",
    family: "jongo",
    bpm: 94,
    numerator: 4,
    denominator: 4,
    description: "Tambores graves e chamada curta.",
  },
  {
    id: "maracatu",
    name: "Maracatu",
    family: "maracatu",
    bpm: 102,
    numerator: 4,
    denominator: 4,
    description: "Alfaias sinteticas com caixa seca.",
  },
  {
    id: "maxixe",
    name: "Maxixe",
    family: "maxixe",
    bpm: 136,
    numerator: 2,
    denominator: 4,
    description: "Pre-samba com pulso animado.",
  },
  {
    id: "pagode",
    name: "Pagode",
    family: "pagode",
    bpm: 108,
    numerator: 4,
    denominator: 4,
    description: "Caixa, pandeiro e tantan sugerido.",
  },
  {
    id: "partido-alto",
    name: "Partido-Alto",
    family: "partidoAlto",
    bpm: 112,
    numerator: 4,
    denominator: 4,
    description: "Levada aberta para improviso.",
  },
  {
    id: "pisadinha",
    name: "Pisadinha",
    family: "pisadinha",
    bpm: 136,
    numerator: 4,
    denominator: 4,
    description: "Drive de pista, simples e eficiente.",
  },
  {
    id: "pop-rock",
    name: "Pop-Rock",
    family: "popRock",
    bpm: 118,
    numerator: 4,
    denominator: 4,
    description: "Pop reto com kick bem resolvido.",
  },
  {
    id: "reggae",
    name: "Reggae",
    family: "reggae",
    bpm: 76,
    numerator: 4,
    denominator: 4,
    description: "One drop e espaco entre acentos.",
  },
  {
    id: "samba",
    name: "Samba",
    family: "samba",
    bpm: 104,
    numerator: 2,
    denominator: 4,
    description: "Base de escola simplificada.",
  },
  {
    id: "samba-enredo",
    name: "Samba Enredo",
    family: "sambaEnredo",
    bpm: 142,
    numerator: 2,
    denominator: 4,
    description: "Mais energia para avenida.",
  },
  {
    id: "samba-cancao",
    name: "Samba Cancao",
    family: "sambaCancao",
    bpm: 82,
    numerator: 4,
    denominator: 4,
    description: "Andamento lento e respirado.",
  },
  {
    id: "samba-de-roda",
    name: "Samba de Roda",
    family: "sambaDeRoda",
    bpm: 108,
    numerator: 2,
    denominator: 4,
    description: "Resposta circular e dancante.",
  },
  {
    id: "samba-rock",
    name: "Samba Rock",
    family: "sambaRock",
    bpm: 110,
    numerator: 4,
    denominator: 4,
    description: "Backbeat cruzado com pandeiro.",
  },
  {
    id: "valsa",
    name: "Valsa",
    family: "valsa",
    bpm: 96,
    numerator: 3,
    denominator: 4,
    description: "Tres tempos claros e suaves.",
  },
  {
    id: "vaneirao",
    name: "Vaneirao",
    family: "vaneirao",
    bpm: 142,
    numerator: 4,
    denominator: 4,
    description: "Pegada sulista e dancante.",
  },
  {
    id: "sertanejo",
    name: "Sertanejo",
    family: "sertanejo",
    bpm: 102,
    numerator: 4,
    denominator: 4,
    description: "Bumbo simples com caixa de apoio.",
  },
  {
    id: "xaxado",
    name: "Xaxado",
    family: "xaxado",
    bpm: 124,
    numerator: 2,
    denominator: 4,
    description: "Andamento rasteiro e repetitivo.",
  },
];

export function mountDrumMachine(target: HTMLDivElement) {
  appRoot = target;

  if (!isBound) {
    bindEventListeners();
    isBound = true;
  }

  customPresets = loadCustomPresets();
  state = createStateFromPreset(factoryPresetTemplates[0]);
  renderApp();
}

function bindEventListeners() {
  appRoot.addEventListener("click", async (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const actionButton = target.closest<HTMLElement>("[data-action]");

    const presetButton = target.closest<HTMLElement>("[data-preset-id]");
    if (presetButton) {
      const presetId = presetButton.dataset.presetId;
      if (presetId) {
        applyPresetById(presetId);
      }
      return;
    }

    const instrumentButton = target.closest<HTMLElement>("[data-add-instrument]");
    if (instrumentButton) {
      const instrumentId = instrumentButton.dataset.addInstrument as InstrumentId | undefined;
      if (instrumentId) {
        addInstrument(instrumentId);
      }
      return;
    }

    const removeButton = target.closest<HTMLElement>("[data-remove-track]");
    if (removeButton) {
      const index = Number(removeButton.dataset.removeTrack);
      removeTrack(index);
      return;
    }

    const stepButton = target.closest<HTMLElement>("[data-step-index]");
    if (stepButton) {
      const trackIndex = Number(stepButton.dataset.trackIndex);
      const stepIndex = Number(stepButton.dataset.stepIndex);
      toggleStep(trackIndex, stepIndex);
      return;
    }

    const action = actionButton?.dataset.action;
    if (!action) {
      return;
    }

    if (action === "play") {
      await togglePlayback();
      return;
    }

    if (action === "stop") {
      stopPlayback();
      return;
    }

    if (action === "clear") {
      clearCurrentPattern();
      return;
    }

    if (action === "save") {
      saveCustomPreset();
      return;
    }

    if (action === "new") {
      createBlankPreset();
      return;
    }

    if (action === "entry-mode") {
      const entryMode = actionButton?.dataset.entryMode as EntryModeId | undefined;
      if (entryMode) {
        state.entryMode = entryMode;
        renderApp();
      }
      return;
    }

    if (action === "add-selected-instrument") {
      const picker = appRoot.querySelector<HTMLSelectElement>("#instrument-picker");
      const instrumentId = picker?.value as InstrumentId | undefined;
      if (instrumentId) {
        addInstrument(instrumentId);
      }
      return;
    }

    if (action === "preset-prev") {
      scrollPresetRail(-1);
      return;
    }

    if (action === "preset-next") {
      scrollPresetRail(1);
    }
  });

  appRoot.addEventListener("input", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }

    if (target.matches("#bpm")) {
      state.bpm = clamp(Number(target.value), MIN_BPM, MAX_BPM);
      syncTransport();
      renderApp();
      return;
    }

    if (target.matches("#numerator")) {
      state.numerator = clamp(Number(target.value), 1, 12);
      resizePattern();
      return;
    }

    if (target.matches("#denominator")) {
      state.denominator = Number(target.value);
      resizePattern();
      return;
    }

    if (target.matches("#preset-name")) {
      state.presetName = target.value;
      return;
    }

    if (target.matches("[data-track-collection]")) {
      const track = state.tracks[Number(target.dataset.trackCollection)];
      if (!track) {
        return;
      }

      track.collectionId = target.value as SampleCollectionId;
      if (track.collectionId === "openSamples") {
        void preloadSample(track.instrumentId);
      }
      renderApp();
      return;
    }

    if (target.matches("[data-track-volume]")) {
      const trackIndex = Number(target.dataset.trackVolume);
      const track = state.tracks[trackIndex];
      if (!track) {
        return;
      }

      track.volume = Number(target.value);
      renderApp();
    }
  });

  appRoot.addEventListener("change", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.matches("[data-track-mute]")) {
      const track = state.tracks[Number(target.dataset.trackMute)];
      if (track) {
        track.mute = target.checked;
        renderApp();
      }
      return;
    }

    if (target.matches("[data-track-solo]")) {
      const track = state.tracks[Number(target.dataset.trackSolo)];
      if (track) {
        track.solo = target.checked;
        renderApp();
      }
    }
  });
}

function renderApp() {
  const availableInstruments = instrumentLibrary.filter(
    (instrument) => !state.tracks.some((track) => track.instrumentId === instrument.id),
  );
  const presetCards = [...factoryPresetTemplates, ...customPresets]
    .map((preset) => renderPresetCard(preset))
    .join("");
  const entryModeButtons = ENTRY_MODES.map(
    (mode) => `
      <button
        class="entry-mode-button ${state.entryMode === mode.id ? "is-active" : ""}"
        type="button"
        data-action="entry-mode"
        data-entry-mode="${mode.id}"
        title="${mode.title}"
        aria-pressed="${state.entryMode === mode.id}"
      >${mode.label}</button>
    `,
  ).join("");

  const instrumentOptions = availableInstruments
    .map(
      (instrument) =>
        `<option value="${instrument.id}">${instrument.name} - ${instrument.group}</option>`,
    )
    .join("");

  const stepsCount = getStepsPerMeasure();

  const trackRows = state.tracks
    .map((track, trackIndex) => {
      const instrument = instrumentMap.get(track.instrumentId);
      if (!instrument) {
        return "";
      }
      const stepButtons = track.steps
        .map((active, stepIndex) => {
          const isPlaying = stepIndex === state.currentStep && state.isPlaying;
          const isBeat = stepIndex % STEPS_PER_BEAT === 0;
          return `
            <button
              type="button"
              class="step ${active ? "is-active" : ""} ${isPlaying ? "is-current" : ""} ${isBeat ? "is-beat" : ""}"
              data-track-index="${trackIndex}"
              data-step-index="${stepIndex}"
              aria-label="${instrument.name} passo ${stepIndex + 1}"
              aria-pressed="${active}"
            ></button>
          `;
        })
        .join("");

      return `
        <article class="track-row">
          <div class="track-row__instrument">
            <strong>${instrument.name}</strong>
            <span>${instrument.group}</span>
          </div>

          <label class="collection-select">
            <select data-track-collection="${trackIndex}">
              ${SAMPLE_COLLECTIONS.map(
                (collection) => `
                  <option value="${collection.id}" ${track.collectionId === collection.id ? "selected" : ""}>
                    ${collection.label}
                  </option>
                `,
              ).join("")}
            </select>
          </label>

          <label class="toggle-inline">
            <input type="checkbox" ${track.solo ? "checked" : ""} data-track-solo="${trackIndex}">
            <span>Solo</span>
          </label>

          <label class="toggle-inline">
            <input type="checkbox" ${track.mute ? "checked" : ""} data-track-mute="${trackIndex}">
            <span>Mudo</span>
          </label>

          <label class="range-field range-field--compact">
            <input
              type="range"
              min="0"
              max="1.2"
              step="0.05"
              value="${track.volume}"
              data-track-volume="${trackIndex}"
            >
          </label>

          <div class="track-row__grid">
            <div class="track-grid" style="--steps:${stepsCount}" data-track-grid="${trackIndex}">${stepButtons}</div>
          </div>

          <button class="ghost-button track-remove" type="button" data-remove-track="${trackIndex}">remover</button>
        </article>
      `;
    })
    .join("");

  appRoot.innerHTML = `
    <main class="shell">
      <header class="app-header">
        <div class="app-logo">BATUCADA <span>/ DRUM MACHINE</span></div>
        <div class="app-header__actions">
          <input
            id="preset-name"
            class="session-input"
            type="text"
            maxlength="48"
            placeholder="Nome da sessao..."
            value="${escapeHtml(state.presetName)}"
          >
          <button class="primary-button" type="button" data-action="save">Salvar</button>
          <button class="ghost-button icon-small" type="button" data-action="new" aria-label="Nova sessao">✦</button>
        </div>
      </header>

      <section class="presets-section">
        <div class="section-kicker">Presets</div>
        <div class="presets-toolbar">
          <button class="ghost-button nav-button" type="button" data-action="preset-prev" aria-label="Preset anterior">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="nav-icon"><path d="M15 5 8 12l7 7" /></svg>
          </button>
          <div class="preset-viewport">
            <div class="preset-rail" data-preset-rail>${presetCards}</div>
          </div>
          <div class="gallery-nav">
            <button class="ghost-button nav-button" type="button" data-action="preset-next" aria-label="Proximo preset">
              <svg viewBox="0 0 24 24" aria-hidden="true" class="nav-icon"><path d="m9 5 7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </section>

      <section class="tracks-panel">
        <div class="tracks-panel__header">
          <div class="section-kicker">Instrumentos</div>
          <div class="tracks-header__actions">
            <select id="instrument-picker" class="select-styled" ${availableInstruments.length === 0 ? "disabled" : ""}>
              ${instrumentOptions || '<option value="">Todos os instrumentos ja foram adicionados</option>'}
            </select>
            <button
              class="secondary-button"
              type="button"
              data-action="add-selected-instrument"
              ${availableInstruments.length === 0 ? "disabled" : ""}
            >
              + Adicionar
            </button>
            <button class="ghost-button" type="button" data-action="clear">Limpar</button>
          </div>
        </div>

        <div class="tracks-stack">
          ${trackRows || '<p class="empty-copy">Nenhum instrumento ativo. Adicione pelo menos uma trilha para montar seu groove.</p>'}
        </div>
      </section>
    </main>

    <aside class="transport-dock">
      <div class="transport-main">
        <button class="play-button ${state.isPlaying ? "is-playing" : ""}" type="button" data-action="play" aria-label="Tocar">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="transport-icon"><path d="m8 5 11 7-11 7z"/></svg>
        </button>
        <button class="stop-button" type="button" data-action="stop" aria-label="Parar">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="transport-icon"><path d="M7 7h10v10H7z"/></svg>
        </button>
      </div>

      <div class="transport-display">
        <div class="transport-display__bpm" data-transport-bpm>${state.bpm}</div>
        <div class="transport-label">BPM</div>
      </div>

      <div class="transport-slider">
        <div class="transport-label">Andamento</div>
        <input id="bpm" type="range" min="${MIN_BPM}" max="${MAX_BPM}" step="1" value="${state.bpm}">
      </div>

      <div class="transport-selects">
        <label class="transport-field">
          <span>Compasso</span>
          <select id="denominator">
            ${AVAILABLE_SIGNATURE_DENOMINATORS.map(
              (denominator) =>
                `<option value="${denominator}" ${state.denominator === denominator ? "selected" : ""}>${denominator}</option>`,
            ).join("")}
          </select>
        </label>
        <label class="transport-field">
          <span>Passos</span>
          <input id="numerator" type="number" min="1" max="12" step="1" value="${state.numerator}">
        </label>
      </div>

      <div class="transport-entry">
        <div class="transport-label">Entrada</div>
        <div class="entry-mode-group">${entryModeButtons}</div>
      </div>

      <div class="transport-pills">
        <span data-transport-signature>${state.numerator}/${state.denominator}</span>
        <span data-transport-steps>${stepsCount} passos</span>
        <span>${state.tracks.length}/${Math.max(state.tracks.length, 1)} ativos</span>
      </div>
    </aside>
  `;

  syncPresetRail();
  syncStepIndicators();
  updateTransportUI();
}

function renderPresetCard(preset: PresetTemplate | CustomPreset) {
  const isSelected = preset.id === state.selectedPresetId;
  const description = "tracks" in preset ? "Preset salvo pelo usuario." : preset.description;

  return `
    <button class="preset-card ${isSelected ? "is-selected" : ""}" type="button" data-preset-id="${preset.id}">
      <strong>${preset.name}</strong>
      <span>${preset.numerator}/${preset.denominator} - ${preset.bpm} BPM</span>
      <small>${description}</small>
    </button>
  `;
}

function createStateFromPreset(preset: PresetTemplate | CustomPreset): AppState {
  const tracks =
    "tracks" in preset
      ? cloneTracks(preset.tracks, getStepsPerMeasureFromValues(preset.numerator))
      : buildPresetTracks(preset.family, getStepsPerMeasureFromValues(preset.numerator));

  return {
    bpm: preset.bpm,
    numerator: preset.numerator,
    denominator: preset.denominator,
    tracks,
    currentStep: 0,
    isPlaying: false,
    selectedPresetId: preset.id,
    presetName: preset.name,
    entryMode: "sixteenth",
  };
}

function applyPresetById(presetId: string) {
  const preset =
    factoryPresetTemplates.find((item) => item.id === presetId) ??
    customPresets.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }

  const wasPlaying = state.isPlaying;
  const nextState = createStateFromPreset(preset);
  state = {
    ...nextState,
    isPlaying: wasPlaying,
    currentStep: state.currentStep % getStepsPerMeasureFromValues(nextState.numerator),
  };

  renderApp();
  syncTransport();
}

function addInstrument(instrumentId: InstrumentId) {
  if (state.tracks.some((track) => track.instrumentId === instrumentId)) {
    return;
  }

  state.tracks.push({
    instrumentId,
    collectionId: DEFAULT_COLLECTION,
    volume: 0.9,
    mute: false,
    solo: false,
    steps: createEmptySteps(getStepsPerMeasure()),
  });

  renderApp();
}

function removeTrack(index: number) {
  state.tracks.splice(index, 1);
  renderApp();
}

function toggleStep(trackIndex: number, stepIndex: number) {
  const track = state.tracks[trackIndex];
  if (!track) {
    return;
  }

  applyEntryMode(track, stepIndex);
  renderApp();
}

async function togglePlayback() {
  if (state.isPlaying) {
    return;
  }

  await ensureAudioContext();
  state.isPlaying = true;
  state.currentStep = state.currentStep % getStepsPerMeasure();
  startTransportClock();
  updateTransportUI();
}

function stopPlayback() {
  stopTransportClock();
  state.isPlaying = false;
  state.currentStep = 0;
  updateTransportUI();
  updateStepIndicators();
}

function clearCurrentPattern() {
  state.tracks = state.tracks.map((track) => ({
    ...track,
    steps: createEmptySteps(getStepsPerMeasure()),
  }));
  state.selectedPresetId = null;
  renderApp();
}

function saveCustomPreset() {
  const name = state.presetName.trim();
  if (!name) {
    state.presetName = `Meu ritmo ${customPresets.length + 1}`;
  }

  const preset: CustomPreset = {
    id: `custom-${slugify(state.presetName)}-${Date.now()}`,
    name: state.presetName.trim() || `Meu ritmo ${customPresets.length + 1}`,
    bpm: state.bpm,
    numerator: state.numerator,
    denominator: state.denominator,
    tracks: cloneTracks(state.tracks, getStepsPerMeasure()),
  };

  customPresets = [preset, ...customPresets];
  persistCustomPresets();
  state.selectedPresetId = preset.id;
  state.presetName = preset.name;
  renderApp();
}

function createBlankPreset() {
  const wasPlaying = state.isPlaying;
  state = {
    bpm: 100,
    numerator: 4,
    denominator: 4,
    tracks: DEFAULT_INSTRUMENTS.map((instrumentId) => ({
      instrumentId,
      collectionId: DEFAULT_COLLECTION,
      volume: 0.9,
      mute: false,
      solo: false,
      steps: createEmptySteps(16),
    })),
    currentStep: 0,
    isPlaying: wasPlaying,
    selectedPresetId: null,
    presetName: "Novo groove",
    entryMode: state.entryMode,
  };
  renderApp();
  syncTransport();
}

function resizePattern() {
  const steps = getStepsPerMeasure();
  state.tracks = state.tracks.map((track) => ({
    ...track,
    steps: resizeSteps(track.steps, steps),
  }));
  state.currentStep %= steps;
  state.selectedPresetId = null;
  renderApp();
  syncTransport();
}

function applyEntryMode(track: TrackState, stepIndex: number) {
  const span = getEntryModeSpan(state.entryMode);

  for (let offset = 0; offset < span; offset += 1) {
    const index = stepIndex + offset;
    if (index >= track.steps.length) {
      break;
    }

    track.steps[index] = state.entryMode !== "rest";
  }
}

function getEntryModeSpan(entryMode: EntryModeId) {
  switch (entryMode) {
    case "quarter":
      return 4;
    case "eighth":
      return 2;
    case "dottedEighth":
      return 3;
    case "rest":
    case "sixteenth":
    default:
      return 1;
  }
}

function startTransportClock() {
  stopTransportClock();
  playCurrentStep();
  transportTimer = window.setInterval(playCurrentStep, getStepDurationMs());
}

function stopTransportClock() {
  if (transportTimer !== null) {
    window.clearInterval(transportTimer);
    transportTimer = null;
  }
}

function syncTransport() {
  if (state.isPlaying) {
    startTransportClock();
  }
}

function playCurrentStep() {
  if (!audioContext) {
    return;
  }

  const context = audioContext;
  const now = context.currentTime + 0.01;
  const soloed = state.tracks.some((track) => track.solo);
  const previousStep = state.currentStep;

  state.tracks.forEach((track) => {
    if (!track.steps[state.currentStep]) {
      return;
    }

    if (track.mute) {
      return;
    }

    if (soloed && !track.solo) {
      return;
    }

    const instrument = instrumentMap.get(track.instrumentId);
    if (!instrument) {
      return;
    }

    const accent = state.currentStep % STEPS_PER_BEAT === 0 ? 1 : 0.82;
    const velocity = track.volume * accent;

    if (!playCollectionInstrument(track, context, now, velocity)) {
      instrument.play(context, now, velocity);
    }
  });

  state.currentStep = (state.currentStep + 1) % getStepsPerMeasure();
  updateStepIndicators(previousStep, state.currentStep);
}

async function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

function playCollectionInstrument(
  track: TrackState,
  context: AudioContext,
  time: number,
  velocity: number,
) {
  if (track.collectionId !== "openSamples") {
    return false;
  }

  const samplePath = OPEN_SAMPLE_MAP[track.instrumentId];
  if (!samplePath) {
    return false;
  }

  const cached = sampleBufferCache.get(samplePath);
  if (!cached) {
    void preloadSample(track.instrumentId);
    return false;
  }

  playSampleBuffer(context, cached, time, velocity);
  return true;
}

async function preloadSample(instrumentId: InstrumentId) {
  const samplePath = OPEN_SAMPLE_MAP[instrumentId];
  if (!samplePath) {
    return null;
  }

  const context = audioContext ?? new AudioContext();
  if (!audioContext) {
    audioContext = context;
  }

  const cached = sampleBufferCache.get(samplePath);
  if (cached) {
    return cached;
  }

  const loading = sampleLoadInFlight.get(samplePath);
  if (loading) {
    return loading;
  }

  const request = fetch(samplePath)
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
      sampleBufferCache.set(samplePath, buffer);
      return buffer;
    })
    .catch(() => null)
    .finally(() => {
      sampleLoadInFlight.delete(samplePath);
    });

  sampleLoadInFlight.set(samplePath, request);
  return request;
}

function playSampleBuffer(
  context: AudioContext,
  buffer: AudioBuffer,
  time: number,
  velocity: number,
) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  gain.gain.setValueAtTime(Math.max(velocity, 0.001), time);
  source.connect(gain);
  gain.connect(context.destination);
  source.start(time);
}

function getStepsPerMeasure() {
  return getStepsPerMeasureFromValues(state.numerator);
}

function getStepsPerMeasureFromValues(numerator: number) {
  return Math.max(numerator * STEPS_PER_BEAT, 1);
}

function getStepDurationMs() {
  const beatSeconds = (60 / state.bpm) * (4 / state.denominator);
  return (beatSeconds * 1000) / STEPS_PER_BEAT;
}

function createEmptySteps(length: number) {
  return Array.from({ length }, () => false);
}

function resizeSteps(steps: boolean[], newLength: number) {
  return Array.from({ length: newLength }, (_, index) => steps[index] ?? false);
}

function cloneTracks(tracks: TrackState[], targetLength: number) {
  return tracks.map((track) => ({
    ...track,
    collectionId: track.collectionId ?? DEFAULT_COLLECTION,
    steps: resizeSteps(track.steps, targetLength),
  }));
}

function loadCustomPresets() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [] as CustomPreset[];
  }

  try {
    const parsed = JSON.parse(raw) as CustomPreset[];
    return parsed.map((preset) => ({
      ...preset,
      tracks: cloneTracks(preset.tracks, getStepsPerMeasureFromValues(preset.numerator)),
    }));
  } catch {
    return [] as CustomPreset[];
  }
}

function persistCustomPresets() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
}

function buildPresetTracks(family: PatternFamily, steps: number): TrackState[] {
  const tracks = patternFactories[family](steps);
  return cloneTracks(tracks, steps);
}

function syncPresetRail() {
  const rail = appRoot.querySelector<HTMLElement>("[data-preset-rail]");
  if (!rail) {
    return;
  }

  rail.scrollLeft = presetRailScrollLeft;
  rail.onscroll = () => {
    presetRailScrollLeft = rail.scrollLeft;
  };
}

function scrollPresetRail(direction: -1 | 1) {
  const rail = appRoot.querySelector<HTMLElement>("[data-preset-rail]");
  if (!rail) {
    return;
  }

  const amount = Math.max(rail.clientWidth * 0.82, 220) * direction;
  rail.scrollBy({ left: amount, behavior: "smooth" });
}

function syncStepIndicators() {
  activeStepButtons = Array.from(appRoot.querySelectorAll<HTMLElement>(".step.is-current"));
}

function updateStepIndicators(_previousStep?: number, currentStep?: number) {
  activeStepButtons.forEach((button) => button.classList.remove("is-current"));

  if (!state.isPlaying) {
    activeStepButtons = [];
    return;
  }

  const stepToActivate = currentStep ?? state.currentStep;
  const nextButtons = Array.from(
    appRoot.querySelectorAll<HTMLElement>(`[data-step-index="${stepToActivate}"]`),
  );
  nextButtons.forEach((button) => button.classList.add("is-current"));
  activeStepButtons = nextButtons;
}

function updateTransportUI() {
  const bpmLabel = appRoot.querySelector<HTMLElement>("[data-transport-bpm]");
  const signatureLabel = appRoot.querySelector<HTMLElement>("[data-transport-signature]");
  const stepsLabel = appRoot.querySelector<HTMLElement>("[data-transport-steps]");
  const playButton = appRoot.querySelector<HTMLElement>(".play-button");

  if (bpmLabel) {
    bpmLabel.textContent = `${state.bpm}`;
  }

  if (signatureLabel) {
    signatureLabel.textContent = `${state.numerator}/${state.denominator}`;
  }

  if (stepsLabel) {
    stepsLabel.textContent = `${getStepsPerMeasure()} passos`;
  }

  if (playButton) {
    playButton.classList.toggle("is-playing", state.isPlaying);
  }
}

function track(
  instrumentId: InstrumentId,
  steps: number,
  volume: number,
  hits: number[],
  options?: Pick<TrackState, "mute" | "solo">,
): TrackState {
  const row = createEmptySteps(steps);

  hits.forEach((step) => {
    const normalized = normalizeStep(step, steps);
    row[normalized] = true;
  });

  return {
    instrumentId,
    collectionId: DEFAULT_COLLECTION,
    volume,
    mute: options?.mute ?? false,
    solo: options?.solo ?? false,
    steps: row,
  };
}

function normalizeStep(step: number, steps: number) {
  return ((step % steps) + steps) % steps;
}

function beat(step: number) {
  return step * STEPS_PER_BEAT;
}

const patternFactories: Record<PatternFamily, (steps: number) => TrackState[]> = {
  balada: (steps) => [
    track("kick", steps, 1, [0, beat(2)]),
    track("snare", steps, 0.85, [beat(1), beat(3)]),
    track("hihatClosed", steps, 0.45, evenSteps(steps, 2)),
    track("clap", steps, 0.45, [beat(1), beat(3)]),
  ],
  rock1: (steps) => [
    track("kick", steps, 1, [0, beat(2), beat(2) + 2]),
    track("snare", steps, 0.9, [beat(1), beat(3)]),
    track("hihatClosed", steps, 0.45, evenSteps(steps, 2)),
    track("tomLow", steps, 0.5, [steps - 2]),
  ],
  rock2: (steps) => [
    track("kick", steps, 1.05, [0, 2, beat(1) + 2, beat(2), beat(2) + 2]),
    track("snare", steps, 0.95, [beat(1), beat(3)]),
    track("hihatClosed", steps, 0.4, evenSteps(steps, 2)),
    track("clap", steps, 0.5, [beat(1), beat(3)]),
  ],
  rock3: (steps) => [
    track("kick", steps, 1, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("snare", steps, 0.85, [beat(1), beat(3)]),
    track("hihatClosed", steps, 0.35, swungSteps(steps)),
    track("hihatOpen", steps, 0.3, [beat(3) + 2]),
  ],
  rock4: (steps) => [
    track("kick", steps, 1, [0, 2, beat(2), beat(2) + 3, beat(3) + 2]),
    track("snare", steps, 0.88, [beat(1), beat(3)]),
    track("hihatClosed", steps, 0.35, evenSteps(steps, 2)),
    track("hihatOpen", steps, 0.35, [beat(1) + 2, beat(3) + 2]),
  ],
  jazz1: (steps) => [
    track("hihatClosed", steps, 0.32, [beat(1), beat(3)]),
    track("cowbell", steps, 0.4, [0, 3, beat(1), beat(1) + 3, beat(2), beat(3) + 3]),
    track("snare", steps, 0.45, [beat(1) + 2, beat(3) + 2]),
    track("kick", steps, 0.45, [0, beat(2)]),
  ],
  jazz2: (steps) => [
    track("cowbell", steps, 0.35, [0, 3, beat(1), beat(1) + 3, beat(2), beat(3) + 3]),
    track("snare", steps, 0.5, [beat(1) + 2, beat(2) + 2]),
    track("kick", steps, 0.45, [0, beat(2) + 2]),
    track("tomHigh", steps, 0.5, [steps - 2]),
  ],
  jazz3: (steps) => [
    track("hihatClosed", steps, 0.35, [beat(1)]),
    track("cowbell", steps, 0.3, [0, 3, beat(1), beat(2) + 3]),
    track("kick", steps, 0.5, [0, beat(1), beat(2)]),
    track("snare", steps, 0.45, [beat(1) + 2]),
  ],
  jazz4: (steps) => [
    track("cowbell", steps, 0.42, [0, 3, beat(1), beat(2) + 3]),
    track("congaOpen", steps, 0.65, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("congaSlap", steps, 0.52, [beat(1), beat(3)]),
    track("kick", steps, 0.45, [0, beat(2)]),
  ],
  axe: (steps) => [
    track("surdo", steps, 1.1, [0, beat(2)]),
    track("caixa", steps, 0.75, [beat(1), beat(3)]),
    track("timbal", steps, 0.8, [2, beat(1) + 2, beat(2) + 2, beat(3) + 2]),
    track("agogoHigh", steps, 0.55, [0, beat(1), beat(2) + 2, beat(3)]),
  ],
  angola: (steps) => [
    track("congaOpen", steps, 0.78, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("congaSlap", steps, 0.62, [beat(1), beat(3)]),
    track("agogoLow", steps, 0.45, [0, beat(2)]),
    track("ganza", steps, 0.3, evenSteps(steps, 2)),
  ],
  arrastape: (steps) => [
    track("triangle", steps, 0.62, evenSteps(steps, 2)),
    track("surdo", steps, 0.95, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("caixa", steps, 0.7, [beat(1), beat(3)]),
    track("ganza", steps, 0.32, everyStep(steps)),
  ],
  arrocha: (steps) => [
    track("kick", steps, 1, [0, beat(2)]),
    track("clap", steps, 0.75, [beat(1), beat(3)]),
    track("hihatClosed", steps, 0.28, evenSteps(steps, 2)),
    track("cowbell", steps, 0.24, [beat(3) + 2]),
  ],
  aguere: (steps) => [
    track("agogoHigh", steps, 0.68, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("agogoLow", steps, 0.55, [beat(1), beat(3)]),
    track("timbal", steps, 0.72, [0, beat(2), beat(3)]),
    track("ganza", steps, 0.28, everyStep(steps)),
  ],
  bachata: (steps) => [
    track("kick", steps, 0.85, [0, beat(1), beat(2), beat(3)]),
    track("clave", steps, 0.55, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("shaker", steps, 0.24, everyStep(steps)),
    track("congaOpen", steps, 0.54, [beat(1), beat(3)]),
  ],
  baiao: (steps) => [
    track("surdo", steps, 1, [0, beat(1) + 2]),
    track("triangle", steps, 0.7, everyStep(steps)),
    track("caixa", steps, 0.62, [beat(1), beat(1) + 2]),
    track("ganza", steps, 0.28, evenSteps(steps, 2)),
  ],
  batuque: (steps) => [
    track("surdo", steps, 0.92, [0, beat(2)]),
    track("congaOpen", steps, 0.68, [beat(1), beat(3)]),
    track("woodBlock", steps, 0.52, [0, beat(1) + 2, beat(2) + 2, beat(3)]),
    track("recoReco", steps, 0.38, evenSteps(steps, 2)),
  ],
  boiBumba: (steps) => [
    track("surdo", steps, 1, [0, beat(1), beat(2), beat(3)]),
    track("caixa", steps, 0.68, [beat(1) + 2, beat(3) + 2]),
    track("agogoLow", steps, 0.4, [0, beat(2)]),
    track("ganza", steps, 0.34, everyStep(steps)),
  ],
  bolero: (steps) => [
    track("kick", steps, 0.95, [0, beat(2)]),
    track("snare", steps, 0.55, [beat(1) + 2, beat(3) + 2]),
    track("cowbell", steps, 0.35, [beat(1), beat(3)]),
    track("shaker", steps, 0.22, evenSteps(steps, 2)),
  ],
  bossa: (steps) => [
    track("kick", steps, 0.72, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("pandeiro", steps, 0.88, [
      0,
      2,
      beat(1),
      beat(1) + 2,
      beat(2),
      beat(2) + 2,
      beat(3),
      beat(3) + 2,
    ]),
    track("clave", steps, 0.45, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("shaker", steps, 0.2, everyStep(steps)),
  ],
  coco: (steps) => [
    track("surdo", steps, 0.9, [0, beat(2)]),
    track("triangle", steps, 0.62, everyStep(steps)),
    track("pandeiro", steps, 0.76, [beat(1), beat(1) + 2, beat(3), beat(3) + 2]),
    track("recoReco", steps, 0.3, evenSteps(steps, 2)),
  ],
  caboclinho: (steps) => [
    track("caixa", steps, 0.75, evenSteps(steps, 2)),
    track("agogoHigh", steps, 0.48, [0, beat(1), beat(2) + 2, beat(3)]),
    track("surdo", steps, 0.82, [0, beat(2)]),
    track("ganza", steps, 0.26, everyStep(steps)),
  ],
  cabula: (steps) => [
    track("congaOpen", steps, 0.72, [0, beat(2)]),
    track("congaSlap", steps, 0.54, [beat(1), beat(3)]),
    track("agogoLow", steps, 0.44, [beat(1) + 2, beat(3) + 2]),
    track("ganza", steps, 0.24, evenSteps(steps, 2)),
  ],
  carimbeo: (steps) => [
    track("surdo", steps, 0.94, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("shaker", steps, 0.28, everyStep(steps)),
    track("pandeiro", steps, 0.62, [beat(1), beat(3)]),
    track("woodBlock", steps, 0.42, [0, beat(2)]),
  ],
  capoeira: (steps) => [
    track("congaOpen", steps, 0.8, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("agogoLow", steps, 0.42, [beat(1), beat(3)]),
    track("recoReco", steps, 0.34, evenSteps(steps, 2)),
    track("ganza", steps, 0.24, everyStep(steps)),
  ],
  cavaloMarinho: (steps) => [
    track("caixa", steps, 0.72, evenSteps(steps, 2)),
    track("surdo", steps, 0.9, [0, beat(2)]),
    track("tambourine", steps, 0.55, [beat(1), beat(3)]),
    track("agogoHigh", steps, 0.36, [0, beat(2) + 2]),
  ],
  chacarera: (steps) => [
    track("kick", steps, 0.88, [0, beat(1), beat(2) + 2, beat(4)]),
    track("snare", steps, 0.62, [beat(1) + 2, beat(4) + 2]),
    track("shaker", steps, 0.26, evenSteps(steps, 2)),
    track("woodBlock", steps, 0.38, [beat(2), beat(5)]),
  ],
  chamame: (steps) => [
    track("kick", steps, 0.86, [0, beat(1), beat(2), beat(3)]),
    track("snare", steps, 0.58, [beat(1) + 2, beat(3) + 2]),
    track("shaker", steps, 0.26, evenSteps(steps, 2)),
    track("cowbell", steps, 0.34, [0, beat(2)]),
  ],
  ciranda: (steps) => [
    track("surdo", steps, 0.96, [0, beat(1), beat(2), beat(3)]),
    track("pandeiro", steps, 0.6, [beat(1) + 2, beat(3) + 2]),
    track("ganza", steps, 0.28, everyStep(steps)),
    track("agogoLow", steps, 0.32, [0, beat(2)]),
  ],
  congoDeOuro: (steps) => [
    track("surdo", steps, 0.94, [0, beat(2)]),
    track("agogoHigh", steps, 0.5, [beat(1), beat(3)]),
    track("caixa", steps, 0.58, [beat(1) + 2, beat(3) + 2]),
    track("ganza", steps, 0.28, everyStep(steps)),
  ],
  fandango: (steps) => [
    track("kick", steps, 0.85, [0, beat(1), beat(2)]),
    track("snare", steps, 0.65, [beat(1) + 2]),
    track("shaker", steps, 0.24, evenSteps(steps, 2)),
    track("woodBlock", steps, 0.36, [0, beat(2)]),
  ],
  forro: (steps) => [
    track("surdo", steps, 0.96, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("triangle", steps, 0.72, everyStep(steps)),
    track("caixa", steps, 0.62, [beat(1), beat(3)]),
    track("ganza", steps, 0.3, evenSteps(steps, 2)),
  ],
  frevo: (steps) => [
    track("caixa", steps, 0.88, everyStep(steps)),
    track("surdo", steps, 0.94, [0, beat(1)]),
    track("agogoHigh", steps, 0.46, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("tambourine", steps, 0.48, evenSteps(steps, 2)),
  ],
  ijexa: (steps) => [
    track("agogoHigh", steps, 0.52, [0, beat(1) + 2, beat(2), beat(3) + 2]),
    track("agogoLow", steps, 0.42, [beat(1), beat(3)]),
    track("surdo", steps, 0.86, [0, beat(2)]),
    track("ganza", steps, 0.24, everyStep(steps)),
  ],
  ilu: (steps) => [
    track("congaOpen", steps, 0.72, [0, beat(2)]),
    track("congaSlap", steps, 0.55, [beat(1), beat(3)]),
    track("agogoLow", steps, 0.42, [beat(1) + 2, beat(3) + 2]),
    track("ganza", steps, 0.24, everyStep(steps)),
  ],
  jongo: (steps) => [
    track("surdo", steps, 1.02, [0, beat(2)]),
    track("congaOpen", steps, 0.72, [beat(1), beat(3)]),
    track("recoReco", steps, 0.32, evenSteps(steps, 2)),
    track("clave", steps, 0.34, [0, beat(2) + 2]),
  ],
  maracatu: (steps) => [
    track("surdo", steps, 1.1, [0, beat(1), beat(2), beat(3)]),
    track("caixa", steps, 0.8, evenSteps(steps, 2)),
    track("agogoLow", steps, 0.42, [0, beat(2)]),
    track("ganza", steps, 0.26, everyStep(steps)),
  ],
  maxixe: (steps) => [
    track("kick", steps, 0.82, [0, beat(1) + 2]),
    track("pandeiro", steps, 0.74, [beat(1), beat(1) + 2, beat(3), beat(3) + 2]),
    track("clave", steps, 0.38, [0, beat(2)]),
    track("shaker", steps, 0.22, everyStep(steps)),
  ],
  pagode: (steps) => [
    track("surdo", steps, 0.92, [0, beat(2)]),
    track("pandeiro", steps, 0.84, [0, 2, beat(1), beat(1) + 2, beat(2), beat(3) + 2]),
    track("caixa", steps, 0.58, [beat(1), beat(3)]),
    track("tambourine", steps, 0.42, [beat(2) + 2, beat(3)]),
  ],
  partidoAlto: (steps) => [
    track("surdo", steps, 0.94, [0, beat(2)]),
    track("pandeiro", steps, 0.86, [0, 2, beat(1), beat(2) + 2, beat(3)]),
    track("caixa", steps, 0.62, [beat(1), beat(3)]),
    track("agogoHigh", steps, 0.36, [beat(1) + 2, beat(3) + 2]),
  ],
  pisadinha: (steps) => [
    track("kick", steps, 1, [0, beat(1), beat(2), beat(3)]),
    track("clap", steps, 0.72, [beat(1), beat(3)]),
    track("hihatClosed", steps, 0.32, evenSteps(steps, 2)),
    track("cowbell", steps, 0.28, [beat(3) + 2]),
  ],
  popRock: (steps) => [
    track("kick", steps, 0.96, [0, beat(2), beat(2) + 2]),
    track("snare", steps, 0.82, [beat(1), beat(3)]),
    track("hihatClosed", steps, 0.36, evenSteps(steps, 2)),
    track("clap", steps, 0.32, [beat(3)]),
  ],
  reggae: (steps) => [
    track("kick", steps, 0.7, [beat(2)]),
    track("snare", steps, 0.74, [beat(2)]),
    track("hihatClosed", steps, 0.22, evenSteps(steps, 2)),
    track("clap", steps, 0.3, [beat(1), beat(3)]),
  ],
  samba: (steps) => [
    track("surdo", steps, 1.05, [0, beat(1) + 2]),
    track("caixa", steps, 0.76, evenSteps(steps, 2)),
    track("pandeiro", steps, 0.84, [0, 2, beat(1), beat(1) + 2, beat(2), beat(2) + 2]),
    track("agogoHigh", steps, 0.38, [beat(1), beat(3)]),
  ],
  sambaEnredo: (steps) => [
    track("surdo", steps, 1.08, [0, beat(1) + 2]),
    track("caixa", steps, 0.88, everyStep(steps)),
    track("tambourine", steps, 0.58, evenSteps(steps, 2)),
    track("repinique", steps, 0.72, [0, beat(2), beat(3)]),
  ],
  sambaCancao: (steps) => [
    track("kick", steps, 0.74, [0, beat(2)]),
    track("pandeiro", steps, 0.68, [beat(1), beat(3)]),
    track("shaker", steps, 0.18, everyStep(steps)),
    track("clave", steps, 0.34, [0, beat(1) + 2, beat(2), beat(3) + 2]),
  ],
  sambaDeRoda: (steps) => [
    track("surdo", steps, 0.96, [0, beat(2)]),
    track("pandeiro", steps, 0.8, [0, beat(1), beat(1) + 2, beat(3)]),
    track("caixa", steps, 0.58, [beat(1), beat(3)]),
    track("agogoLow", steps, 0.34, [beat(1) + 2, beat(3) + 2]),
  ],
  sambaRock: (steps) => [
    track("kick", steps, 0.92, [0, beat(2), beat(2) + 2]),
    track("snare", steps, 0.76, [beat(1), beat(3)]),
    track("pandeiro", steps, 0.72, [0, 2, beat(1), beat(2) + 2, beat(3)]),
    track("hihatClosed", steps, 0.28, evenSteps(steps, 2)),
  ],
  valsa: (steps) => [
    track("kick", steps, 0.84, [0, beat(1), beat(2)]),
    track("snare", steps, 0.46, [beat(1) + 2]),
    track("shaker", steps, 0.22, evenSteps(steps, 2)),
    track("triangle", steps, 0.28, [beat(2)]),
  ],
  vaneirao: (steps) => [
    track("kick", steps, 0.92, [0, beat(1), beat(2), beat(3)]),
    track("snare", steps, 0.62, [beat(1) + 2, beat(3) + 2]),
    track("shaker", steps, 0.28, evenSteps(steps, 2)),
    track("cowbell", steps, 0.32, [0, beat(2)]),
  ],
  sertanejo: (steps) => [
    track("kick", steps, 0.92, [0, beat(2)]),
    track("snare", steps, 0.7, [beat(1), beat(3)]),
    track("hihatClosed", steps, 0.28, evenSteps(steps, 2)),
    track("clap", steps, 0.28, [beat(3)]),
  ],
  xaxado: (steps) => [
    track("surdo", steps, 0.92, [0, beat(1) + 2]),
    track("triangle", steps, 0.7, everyStep(steps)),
    track("caixa", steps, 0.52, [beat(1), beat(1) + 2]),
    track("ganza", steps, 0.28, evenSteps(steps, 2)),
  ],
};

function evenSteps(steps: number, step: number) {
  return Array.from({ length: Math.ceil(steps / step) }, (_, index) => index * step).filter(
    (value) => value < steps,
  );
}

function everyStep(steps: number) {
  return Array.from({ length: steps }, (_, index) => index);
}

function swungSteps(steps: number) {
  return Array.from({ length: Math.floor(steps / 4) }, (_, beatIndex) => [
    beatIndex * 4,
    beatIndex * 4 + 3,
  ]).flat();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function createNoiseBuffer(context: AudioContext) {
  const size = Math.max(1, Math.floor(context.sampleRate * 0.25));
  const buffer = context.createBuffer(1, size, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < size; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

function createNoiseSource(context: AudioContext, time: number) {
  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context);
  source.start(time);
  return source;
}

function createEnvelope(
  context: AudioContext,
  time: number,
  volume: number,
  attack = 0.001,
  decay = 0.12,
) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  gain.connect(context.destination);
  return gain;
}

function playKick(context: AudioContext, time: number, velocity: number) {
  const osc = context.createOscillator();
  const gain = createEnvelope(context, time, 0.9 * velocity, 0.001, 0.22);
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.22);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.25);
}

function playSnare(context: AudioContext, time: number, velocity: number) {
  const noise = createNoiseSource(context, time);
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = 1600;
  const noiseGain = createEnvelope(context, time, 0.38 * velocity, 0.001, 0.11);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noise.stop(time + 0.12);

  const tone = context.createOscillator();
  const toneGain = createEnvelope(context, time, 0.28 * velocity, 0.001, 0.1);
  tone.type = "triangle";
  tone.frequency.setValueAtTime(190, time);
  tone.connect(toneGain);
  tone.start(time);
  tone.stop(time + 0.12);
}

function playClosedHat(context: AudioContext, time: number, velocity: number) {
  playFilteredNoise(context, time, velocity, 7000, 0.05);
}

function playOpenHat(context: AudioContext, time: number, velocity: number) {
  playFilteredNoise(context, time, velocity, 6000, 0.18);
}

function playTom(context: AudioContext, time: number, velocity: number, frequency: number) {
  const osc = context.createOscillator();
  const gain = createEnvelope(context, time, 0.55 * velocity, 0.001, 0.22);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, time);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.65, time + 0.18);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.24);
}

function playClap(context: AudioContext, time: number, velocity: number) {
  [0, 0.016, 0.028].forEach((offset) => {
    playFilteredNoise(context, time + offset, velocity * 0.52, 2200, 0.045);
  });
}

function playShaker(context: AudioContext, time: number, velocity: number) {
  playFilteredNoise(context, time, velocity * 0.42, 4200, 0.06);
}

function playTambourine(context: AudioContext, time: number, velocity: number) {
  playFilteredNoise(context, time, velocity * 0.54, 5200, 0.12);
  playMetalTone(context, time, velocity * 0.24, 920, 0.08);
}

function playCowbell(context: AudioContext, time: number, velocity: number) {
  playMetalTone(context, time, velocity * 0.52, 560, 0.14);
  playMetalTone(context, time, velocity * 0.24, 845, 0.11);
}

function playAgogo(context: AudioContext, time: number, velocity: number, frequency: number) {
  playMetalTone(context, time, velocity * 0.48, frequency, 0.16);
  playMetalTone(context, time, velocity * 0.24, frequency * 1.5, 0.1);
}

function playConga(context: AudioContext, time: number, velocity: number, frequency: number) {
  const osc = context.createOscillator();
  const gain = createEnvelope(context, time, 0.58 * velocity, 0.001, 0.18);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, time);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.78, time + 0.12);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.2);
  playFilteredNoise(context, time, velocity * 0.16, 1800, 0.03);
}

function playSurdo(context: AudioContext, time: number, velocity: number) {
  const osc = context.createOscillator();
  const gain = createEnvelope(context, time, 1.08 * velocity, 0.001, 0.34);
  osc.type = "sine";
  osc.frequency.setValueAtTime(92, time);
  osc.frequency.exponentialRampToValueAtTime(48, time + 0.3);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.34);
}

function playPandeiro(context: AudioContext, time: number, velocity: number) {
  playFilteredNoise(context, time, velocity * 0.38, 4500, 0.08);
  const osc = context.createOscillator();
  const gain = createEnvelope(context, time, 0.24 * velocity, 0.001, 0.08);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(420, time);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.08);
}

function playTimbal(context: AudioContext, time: number, velocity: number) {
  const osc = context.createOscillator();
  const gain = createEnvelope(context, time, 0.64 * velocity, 0.001, 0.14);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(300, time);
  osc.frequency.exponentialRampToValueAtTime(240, time + 0.12);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.15);
  playFilteredNoise(context, time, velocity * 0.2, 2600, 0.035);
}

function playRepinique(context: AudioContext, time: number, velocity: number) {
  const osc = context.createOscillator();
  const gain = createEnvelope(context, time, 0.54 * velocity, 0.001, 0.12);
  osc.type = "square";
  osc.frequency.setValueAtTime(380, time);
  osc.frequency.exponentialRampToValueAtTime(310, time + 0.08);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.13);
}

function playCaixa(context: AudioContext, time: number, velocity: number) {
  playSnare(context, time, velocity * 0.92);
}

function playGanza(context: AudioContext, time: number, velocity: number) {
  playFilteredNoise(context, time, velocity * 0.34, 3800, 0.05);
}

function playTriangle(context: AudioContext, time: number, velocity: number) {
  playMetalTone(context, time, velocity * 0.4, 1200, 0.18);
}

function playRecoReco(context: AudioContext, time: number, velocity: number) {
  [0, 0.012, 0.024].forEach((offset) => {
    playFilteredNoise(context, time + offset, velocity * 0.22, 2400, 0.025);
  });
}

function playClave(context: AudioContext, time: number, velocity: number) {
  const osc = context.createOscillator();
  const gain = createEnvelope(context, time, 0.34 * velocity, 0.001, 0.06);
  osc.type = "square";
  osc.frequency.setValueAtTime(1650, time);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.07);
}

function playWoodBlock(context: AudioContext, time: number, velocity: number) {
  const osc = context.createOscillator();
  const gain = createEnvelope(context, time, 0.42 * velocity, 0.001, 0.08);
  osc.type = "square";
  osc.frequency.setValueAtTime(880, time);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.09);
}

function playMetalTone(
  context: AudioContext,
  time: number,
  velocity: number,
  frequency: number,
  decay: number,
) {
  const osc = context.createOscillator();
  const gain = createEnvelope(context, time, velocity, 0.001, decay);
  osc.type = "square";
  osc.frequency.setValueAtTime(frequency, time);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + decay + 0.02);
}

function playFilteredNoise(
  context: AudioContext,
  time: number,
  velocity: number,
  frequency: number,
  decay: number,
) {
  const noise = createNoiseSource(context, time);
  const filter = context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = frequency;
  const gain = createEnvelope(context, time, velocity, 0.001, decay);
  noise.connect(filter);
  filter.connect(gain);
  noise.stop(time + decay + 0.03);
}

let customPresets: CustomPreset[] = [];
let state!: AppState;
