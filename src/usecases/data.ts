/**
 * Use-case catalogue. Each entry pairs a 3D scene (scenes.tsx, same id) with the engineering facts a
 * learner needs: what carries the data, how far, how fast, what goes wrong and which standards apply.
 * Numbers are typical published ranges, not records; refs point to the surveys that report them.
 * To add a use case: add an entry here and a scene with the same id in scenes.tsx.
 */
export type Tech = 'VLC' | 'LiFi' | 'OCC' | 'FSO' | 'UWOC' | 'IR';

export interface UseCase {
  id: string;
  title: string;
  tagline: string;
  tech: Tech[];
  /** short "what is happening in the scene" */
  story: string;
  link: { tx: string; rx: string; wavelength: string; range: string; rate: string; modulation: string };
  /** step-by-step flow shown as a visual chain */
  flow: string[];
  challenges: { title: string; text: string }[];
  standards: string[];
  refs: string[];
  lessons: string[];
  /** Optical Bench scenario that recreates this case, if any */
  bench?: string;
  camera: [number, number, number];
  target: [number, number, number];
  accent: string;
}

export const USE_CASES: UseCase[] = [
  {
    id: 'office',
    title: 'LiFi office',
    tagline: 'Every ceiling light becomes a small, fast access point.',
    tech: ['LiFi', 'VLC', 'IR'],
    story:
      'Four luminaires each serve their own pool of light, an "attocell". Laptops receive on the downlink in visible light and answer on an infrared uplink. When someone walks between cells, the network hands them over.',
    link: { tx: 'Ceiling LED luminaires (downlink), IR LED on the dongle (uplink)', rx: 'Si PIN photodiode with concentrator', wavelength: '400–700 nm down, 850–950 nm up', range: '2–3 m', rate: '100 Mb/s – 1 Gb/s per cell', modulation: 'DCO-OFDM with adaptive bit loading' },
    flow: ['Router', 'LiFi AP in luminaire', 'Light cone (attocell)', 'Photodiode dongle', 'IR uplink', 'Handover'],
    challenges: [
      { title: 'Blockage', text: 'A hand or a head can shadow the line of sight. Cells overlap and the network switches access points, or falls back to Wi-Fi.' },
      { title: 'Random orientation', text: 'A tilted laptop or phone sees the light at a steep angle; received power falls as cos ψ and can leave the field of view.' },
      { title: 'Inter-cell interference', text: 'Neighbouring luminaires overlap at the cell edge, so frequency reuse or coordinated transmission is needed.' },
    ],
    standards: ['IEEE 802.11bb', 'ITU-T G.9991', 'IEEE 802.15.13'],
    refs: ['haas2016lifi', 'wu2021hybrid', 'soltani2019orientation', 'ieee80211bb'],
    lessons: ['lifi-networks', 'lambertian-channel', 'optical-ofdm'],
    bench: 'office',
    camera: [7.5, 5.5, 8.5],
    target: [0, 0.8, 0],
    accent: '#ffd27a',
  },
  {
    id: 'streets',
    title: 'Vehicles & smart streets',
    tagline: 'Tail lights, headlights, traffic lights and street lamps that talk.',
    tech: ['VLC', 'OCC'],
    story:
      'The leading car modulates its LED tail lights so the follower learns about hard braking within milliseconds (V2V). The traffic light broadcasts its timing to approaching cars, and street lamps push map and safety data down to the road (I2V).',
    link: { tx: 'LED head/tail lights, traffic lights, street lamps', rx: 'Photodiode behind a lens, or the car’s camera', wavelength: 'Red (tail), white (head), RGY (signals)', range: '10–100 m', rate: 'kb/s (camera) to tens of Mb/s (PD)', modulation: 'OOK / Manchester, UFSOOK for cameras' },
    flow: ['Brake sensor', 'Tail-light driver', 'Red LED light', 'Lens + PD / camera', 'Decoder', 'Driver assistance'],
    challenges: [
      { title: 'Sunlight', text: 'Daylight can be 1000× brighter than the signal. Narrow FOV, optical filters and AC coupling are essential.' },
      { title: 'Mobility and range', text: 'The geometry changes every millisecond; received power swings with distance squared and lane offset.' },
      { title: 'Weather', text: 'Fog, rain and snow scatter the light; links shorten from ~100 m to tens of metres.' },
    ],
    standards: ['IEEE 802.15.7 (PHY I, OCC PHYs)'],
    refs: ['memedi2021vvlc', 'saeed2019occ', 'ieee802157'],
    lessons: ['camera-occ', 'noise-snr', 'single-carrier'],
    bench: 'street',
    camera: [13, 7, 15],
    target: [0, 1, 0],
    accent: '#ff6f86',
  },
  {
    id: 'isl',
    title: 'Satellite-to-satellite',
    tagline: 'Laser links stitch a constellation into a mesh in orbit.',
    tech: ['FSO'],
    story:
      'Each satellite carries optical terminals pointing at its neighbours, in the same orbital plane and in adjacent planes. No atmosphere, no weather; the hard part is pointing a beam a few microradians wide at a target thousands of kilometres away that is moving at 7 km/s.',
    link: { tx: '1550 nm laser + telescope', rx: 'Telescope + coherent or IM/DD receiver', wavelength: '1064 / 1550 nm', range: '1,000 – 5,000 km', rate: '10 – 100+ Gb/s', modulation: 'OOK, DPSK, coherent QPSK' },
    flow: ['Router on board', 'Laser terminal', 'Fine pointing (PAT)', 'µrad beam in vacuum', 'Telescope', 'Receiver'],
    challenges: [
      { title: 'Pointing, acquisition, tracking', text: 'A beam 10 µrad wide spreads to ~20 m at 2000 km; platform jitter must be far smaller than that.' },
      { title: 'Doppler and point-ahead', text: 'The target moves while light is in flight, so the transmitter must aim slightly ahead.' },
      { title: 'Geometric loss', text: 'Even with perfect pointing, only a tiny fraction of the beam lands on the receiving aperture.' },
    ],
    standards: ['CCSDS optical communications', 'SDA OCT standard'],
    refs: ['chaudhry2021isl', 'kaushal2017space'],
    lessons: ['outdoor-underwater', 'drivers-lasers'],
    bench: 'space',
    camera: [0, 13, 36],
    target: [0, 0, 0],
    accent: '#8fa6ff',
  },
  {
    id: 'ground',
    title: 'Ground to space',
    tagline: 'Optical ground stations punch through the atmosphere.',
    tech: ['FSO'],
    story:
      'A telescope sends an uplink beacon and receives the satellite’s downlink. The first 20 km of air do almost all the damage: turbulence makes the beam wander and twinkle, and a passing cloud cuts the link completely, so operators use several ground stations in different weather.',
    link: { tx: 'Satellite laser terminal / ground telescope', rx: 'Large telescope + APD or coherent receiver', wavelength: '1550 nm', range: '500 – 36,000 km', rate: '1 – 200 Gb/s', modulation: 'OOK, PPM (deep space), coherent' },
    flow: ['Satellite terminal', 'Vacuum', 'Atmosphere (turbulence)', 'Clouds?', 'Telescope + AO', 'Detector'],
    challenges: [
      { title: 'Scintillation', text: 'Random refractive-index cells focus and defocus the beam; received power fades by many dB in milliseconds.' },
      { title: 'Clouds', text: 'Clouds attenuate by tens of dB. Site diversity (stations far apart) is the only practical cure.' },
      { title: 'Beam wander', text: 'Turbulence near the transmitter steers the uplink beam off the satellite.' },
    ],
    standards: ['CCSDS 141.x (optical)'],
    refs: ['kaushal2017space', 'khalighi2014fso', 'andrews2005book'],
    lessons: ['outdoor-underwater', 'channel-impairments'],
    camera: [26, 10, 30],
    target: [0, 14, 0],
    accent: '#c39bff',
  },
  {
    id: 'underwater',
    title: 'Underwater networks',
    tagline: 'Blue-green light links robots, sensors and buoys.',
    tech: ['UWOC'],
    story:
      'An autonomous underwater vehicle downloads data from sea-floor sensors with a blue-green beam, then a buoy relays it to the surface. Acoustics manages kb/s over kilometres; light manages Mb/s to Gb/s over tens of metres.',
    link: { tx: '450–520 nm laser diode or LED', rx: 'PMT, APD or SiPM (photon-starved)', wavelength: '450 – 532 nm', range: '10 – 100 m', rate: '1 Mb/s – 10 Gb/s', modulation: 'OOK, PPM, OFDM' },
    flow: ['Sensor node', 'Blue laser', 'Water: absorption + scattering', 'Turbulence & bubbles', 'PMT / SiPM', 'AUV → buoy → RF'],
    challenges: [
      { title: 'Absorption and scattering', text: 'Pure water is clearest in blue; turbid harbour water loses ~2 dB per metre.' },
      { title: 'Alignment', text: 'Narrow beams go further but AUVs and buoys move; wide beams forgive pointing but lose power.' },
      { title: 'Turbulence and bubbles', text: 'Temperature and salinity gradients plus air bubbles cause deep, fast fades.' },
    ],
    standards: [],
    refs: ['zeng2017uwoc', 'kaushal2016uwoc'],
    lessons: ['outdoor-underwater', 'channel-impairments', 'photodetectors'],
    bench: 'underwater',
    camera: [10, 4.5, 12],
    target: [0, 2.5, 0],
    accent: '#5ee0d0',
  },
  {
    id: 'tv',
    title: 'TV to phone',
    tagline: 'A screen broadcasts hidden data to any camera pointed at it.',
    tech: ['OCC'],
    story:
      'The TV adds tiny, fast brightness changes to the picture: invisible to the eye, which averages them out, but recoverable by a phone camera. Point the phone at the screen and it receives a link, a coupon or extra content without any radio.',
    link: { tx: 'LCD/OLED screen (pixel blocks)', rx: 'Smartphone CMOS camera', wavelength: 'Visible (RGB sub-pixels)', range: '0.5 – 5 m', rate: '10 kb/s – 1 Mb/s', modulation: 'Complementary frames, colour/brightness blocks' },
    flow: ['Video + data', 'Imperceptible frame pairs', 'Screen light', 'Camera frames', 'Block detection', 'Payload'],
    challenges: [
      { title: 'Flicker vs. visibility', text: 'Changes must stay below what the eye can see but above camera noise.' },
      { title: 'Frame-rate mismatch', text: 'Screen and camera are not synchronised; frames blend and must be detected and discarded.' },
      { title: 'Perspective & blur', text: 'The phone sees the screen at an angle and shakes; blocks must be found and rectified.' },
    ],
    standards: ['IEEE 802.15.7 OCC PHYs (IV–VI)'],
    refs: ['wang2015inframe', 'saeed2019occ', 'cahyadi2020occ'],
    lessons: ['camera-occ'],
    bench: 'screen',
    camera: [3.4, 2, 3.6],
    target: [0, 1.1, 0],
    accent: '#6fe0ff',
  },
  {
    id: 'display',
    title: 'Display to display',
    tagline: 'Two phones swap files with flashing colour barcodes.',
    tech: ['OCC'],
    story:
      'One screen shows a stream of colour barcodes; the other device’s camera reads them, frame after frame. Each block of pixels is a sub-channel, so a screen-camera link is really a huge visual MIMO system with millions of tiny transmitters.',
    link: { tx: 'Phone / monitor screen', rx: 'Phone camera', wavelength: 'Visible RGB', range: '5 cm – 2 m', rate: '100 kb/s – 10 Mb/s', modulation: 'Colour barcodes, OFDM-like "PixNet" blocks' },
    flow: ['File', 'FEC + framing', 'Colour barcode frames', 'Screen → air → lens', 'Camera pixels', 'Decode + reassemble'],
    challenges: [
      { title: 'Blur and inter-pixel interference', text: 'The camera lens blurs neighbouring blocks into each other; small blocks raise rate but also errors.' },
      { title: 'Rolling-shutter tearing', text: 'Frames change while the camera is still reading rows, so one photo can contain two barcodes.' },
      { title: 'Colour distortion', text: 'Screen gamut and camera response differ; colours need calibration.' },
    ],
    standards: [],
    refs: ['perli2010pixnet', 'hu2013lightsync'],
    lessons: ['camera-occ', 'csk-mimo'],
    bench: 'screen',
    camera: [0.42, 0.42, 0.62],
    target: [0, 0.14, 0],
    accent: '#ff86b0',
  },
  {
    id: 'retail',
    title: 'Indoor positioning',
    tagline: 'Each ceiling light whispers its ID; your phone works out where you are.',
    tech: ['VLC', 'OCC'],
    story:
      'Every downlight flickers its own identifier far too fast to see. A phone camera pointed up decodes the IDs in view, looks up where those lights are, and triangulates its own position to within centimetres, without GPS.',
    link: { tx: 'LED downlights (beacon IDs)', rx: 'Phone camera or photodiode', wavelength: 'Visible', range: '2–5 m', rate: 'bits per second (IDs only)', modulation: 'FSK/OOK beacons, rolling shutter' },
    flow: ['Light ID', 'Downlight flicker', 'Phone camera', 'Decode IDs + angles', 'Map lookup', 'Position'],
    challenges: [
      { title: 'Seeing enough lights', text: 'Accurate fixes need two or more lights in view; the camera FOV and ceiling height decide this.' },
      { title: 'Orientation', text: 'Angle-of-arrival methods need the phone’s tilt from its IMU.' },
      { title: 'Multipath', text: 'Reflections bias received-signal-strength methods; camera-based angle methods are more robust.' },
    ],
    standards: ['IEEE 802.15.7'],
    refs: ['zhuang2018vlp', 'saeed2019occ'],
    lessons: ['positioning-sensing', 'camera-occ'],
    bench: 'office',
    camera: [8, 7, 8],
    target: [0, 0.8, 0],
    accent: '#5ee0a8',
  },
  {
    id: 'fso',
    title: 'Building to building',
    tagline: 'A fibre-speed laser link across the street, with no trenching.',
    tech: ['FSO'],
    story:
      'Rooftop terminals carry gigabits between buildings hundreds of metres apart: last-mile access, campus backhaul and 5G fronthaul. Clear air is easy; fog is the enemy, so links often pair the laser with a radio backup.',
    link: { tx: '850 / 1550 nm laser', rx: 'Lens + APD/PIN', wavelength: '850 / 1550 nm', range: '100 m – 5 km', rate: '1 – 100 Gb/s', modulation: 'OOK, PAM-4, coherent' },
    flow: ['Fibre', 'Laser terminal', 'Atmosphere', 'Fog / rain / turbulence', 'Receiver lens', 'Fibre'],
    challenges: [
      { title: 'Fog', text: 'Dense fog attenuates by more than 100 dB/km; nothing optical survives that over a kilometre.' },
      { title: 'Building sway', text: 'Thermal expansion and wind move rooftops; active tracking or wider beams are needed.' },
      { title: 'Eye safety', text: 'Beam power is limited by laser safety classes; 1550 nm allows more power than 850 nm.' },
    ],
    standards: ['IEC 60825-1 (laser safety)'],
    refs: ['khalighi2014fso', 'kim2001', 'alzenad2018fso'],
    lessons: ['outdoor-underwater', 'channel-impairments'],
    bench: 'fso',
    camera: [70, 45, 75],
    target: [0, 22, 0],
    accent: '#ff9a6b',
  },
  {
    id: 'cabin',
    title: 'Aircraft cabin',
    tagline: 'Reading lights deliver in-flight connectivity with no RF interference.',
    tech: ['LiFi', 'VLC'],
    story:
      'Each seat already has a reading light pointed exactly at the passenger. Turning those lights into LiFi access points gives every seat its own private, interference-free link, while cutting cable weight from in-seat entertainment systems.',
    link: { tx: 'Reading-light LEDs', rx: 'Seat-back screen or passenger device', wavelength: 'Visible + IR uplink', range: '0.5 – 1.5 m', rate: '10 Mb/s – 1 Gb/s', modulation: 'OFDM / OOK' },
    flow: ['Cabin server', 'Reading light', 'Seat cone', 'Device PD', 'IR uplink'],
    challenges: [
      { title: 'Dimming', text: 'Passengers switch reading lights off; the link must survive very low brightness (or move to IR).' },
      { title: 'Certification', text: 'Everything on board needs aviation certification for weight, power and safety.' },
    ],
    standards: ['IEEE 802.11bb'],
    refs: ['haas2016lifi', 'matheus2019'],
    lessons: ['lifi-networks', 'single-carrier'],
    camera: [2.6, 1.9, -4.2],
    target: [0, 1, 1.5],
    accent: '#ffd27a',
  },
  {
    id: 'factory',
    title: 'Industrial wireless',
    tagline: 'Robots and AGVs on optical links that do not jam each other.',
    tech: ['LiFi', 'IR'],
    story:
      'Ceiling access points send control data to moving robots and automated guided vehicles. Light stays inside the cell it was aimed at, so dozens of machines can share the same spectrum with low, predictable latency, and nothing leaks outside the factory.',
    link: { tx: 'IR LED arrays in the ceiling', rx: 'PD arrays on robots / AGVs', wavelength: '850 – 950 nm', range: '2 – 10 m', rate: '10 Mb/s – 1 Gb/s', modulation: 'OFDM, MIMO' },
    flow: ['PLC / controller', 'Optical AP', 'IR cone', 'Robot PD array', 'Real-time control'],
    challenges: [
      { title: 'Shadowing by machinery', text: 'Metal parts block the line of sight; multiple APs (spatial diversity) keep links up.' },
      { title: 'Latency and reliability', text: 'Control loops need millisecond latency and very low packet loss.' },
    ],
    standards: ['IEEE 802.15.13'],
    refs: ['berenguer2018industrial', 'ieee8021513'],
    lessons: ['csk-mimo', 'lifi-networks'],
    camera: [8, 6, 8],
    target: [0, 1, 0],
    accent: '#ffbe5c',
  },
  {
    id: 'drone',
    title: 'Drone relays',
    tagline: 'Hovering laser relays restore backhaul after a disaster.',
    tech: ['FSO', 'VLC'],
    story:
      'A drone hovers above a disaster area and relays traffic between a ground vehicle and a distant network node over optical links, while also lighting the scene. Hovering means constant small motion, so the beams have to be wide enough or actively tracked.',
    link: { tx: 'Laser / LED on drone and ground units', rx: 'APD with wide-FOV optics', wavelength: '850 – 1550 nm (FSO), visible (VLC)', range: '50 m – 2 km', rate: '100 Mb/s – 10 Gb/s', modulation: 'OOK, OFDM' },
    flow: ['Core network', 'Ground FSO node', 'Laser to drone', 'Drone relay', 'Downlink to users'],
    challenges: [
      { title: 'Hovering jitter', text: 'Wind and propeller vibration move the platform by centimetres; beam footprint and tracking must cover it.' },
      { title: 'Power on board', text: 'Every watt of optical power shortens flight time.' },
    ],
    standards: [],
    refs: ['alzenad2018fso', 'khalighi2014fso'],
    lessons: ['outdoor-underwater', 'drivers-lasers'],
    camera: [10, 6, 12],
    target: [0, 3, 0],
    accent: '#6fe0ff',
  },
  {
    id: 'retro',
    title: 'Battery-free tags',
    tagline: 'A retroreflector that blinks back: the ceiling light powers and reads the tag.',
    tech: ['VLC'],
    story:
      'A tiny tag is mostly a retroreflector covered by an LCD shutter. The ceiling light’s own beam bounces straight back to a detector next to the lamp; the tag sends data by opening and closing its shutter, using microwatts from a small solar cell.',
    link: { tx: 'Ceiling LED (illuminates the tag)', rx: 'PD beside the lamp', wavelength: 'Visible', range: '1 – 5 m', rate: '0.1 – 10 kb/s', modulation: 'OOK via LCD shutter' },
    flow: ['LED downlink', 'Tag solar cell', 'LCD shutter on retroreflector', 'Reflected beam back', 'PD at lamp'],
    challenges: [
      { title: 'Shutter speed', text: 'LCD switching (~1 ms) limits the uplink rate.' },
      { title: 'Self-interference', text: 'The detector beside the lamp also sees the lamp’s direct light, which must be cancelled.' },
    ],
    standards: [],
    refs: ['li2015retrovlc', 'celik2023iot'],
    lessons: ['owc-landscape', 'optics-frontend'],
    bench: 'office',
    camera: [3.2, 2.4, 3.4],
    target: [0, 1, 0],
    accent: '#c39bff',
  },
];

export const useCaseById = (id: string) => USE_CASES.find((u) => u.id === id);
