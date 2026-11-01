import { generateWordSearch, SeededRandom, type WordSearchResult } from './word-search';

/**
 * Built-in word lists for themed word search books. Each theme has topics;
 * each puzzle uses one topic, which becomes its heading.
 */
export interface WordTopic {
  title: string;
  words: string[];
}

export interface WordTheme {
  name: string;
  topics: WordTopic[];
}

const list = (words: string) => words.trim().split(/\s+/);

export const WORD_THEMES = {
  animals: {
    name: 'Animals',
    topics: [
      { title: 'On the Farm', words: list('cow horse pig sheep goat chicken rooster duck goose turkey donkey llama rabbit lamb calf foal barn tractor hay pasture') },
      { title: 'Ocean Life', words: list('whale dolphin shark octopus squid jellyfish starfish seahorse turtle crab lobster shrimp seal walrus coral clam oyster eel stingray urchin') },
      { title: 'In the Jungle', words: list('tiger jaguar gorilla monkey parrot toucan sloth python anaconda frog chameleon leopard orangutan tapir macaw iguana gecko lemur panther ocelot') },
      { title: 'On the Savanna', words: list('lion zebra giraffe elephant rhino hippo cheetah hyena antelope gazelle buffalo warthog ostrich meerkat baboon vulture jackal impala wildebeest leopard') },
      { title: 'Birds', words: list('robin sparrow eagle hawk falcon owl crow raven pigeon dove swan heron pelican penguin flamingo parrot woodpecker hummingbird cardinal bluejay') },
      { title: 'Bugs and Insects', words: list('ant bee wasp scarab butterfly moth dragonfly ladybug cricket grasshopper firefly mosquito termite caterpillar cicada stinkbug flea hornet weevil aphid') },
      { title: 'Pets', words: list('dog puppy cat kitten hamster gerbil goldfish parakeet rabbit guineapig turtle ferret pony canary leash collar treat kennel whiskers paws') },
    ],
  },
  food: {
    name: 'Food and Cooking',
    topics: [
      { title: 'Fruits', words: list('apple banana cherry grape lemon lime mango melon orange peach pear plum kiwi papaya apricot berry coconut fig guava lychee') },
      { title: 'Vegetables', words: list('carrot potato tomato onion garlic pepper lettuce spinach celery cabbage broccoli pea bean corn radish beet squash pumpkin zucchini cucumber') },
      { title: 'Baking', words: list('flour sugar butter eggs yeast dough oven whisk bowl knead rise bread cake cookie muffin pie crust frosting sprinkles vanilla') },
      { title: 'Breakfast', words: list('pancake waffle toast bacon sausage omelet cereal oatmeal yogurt granola juice coffee tea muffin bagel syrup honey jam butter croissant') },
      { title: 'Desserts', words: list('cake pie brownie cookie pudding custard sundae icecream fudge candy toffee tart eclair donut mousse sorbet cobbler caramel truffle macaron') },
      { title: 'In the Kitchen', words: list('stove oven fridge sink kettle toaster blender mixer spatula ladle knife fork spoon pan pot skillet grater peeler colander apron') },
    ],
  },
  nature: {
    name: 'Nature and Seasons',
    topics: [
      { title: 'Spring', words: list('blossom tulip daffodil rain puddle umbrella bud sprout nest robin bloom garden seeds bunny breeze lamb easter fresh green growth') },
      { title: 'Summer', words: list('sun beach waves swim picnic lemonade vacation camping hiking barbecue heat shorts flipflops boat kayak pool ocean fireflies watermelon') },
      { title: 'Autumn', words: list('leaves pumpkin harvest hazelnut apple cider scarecrow hayride orchard maple sweater rake bonfire squirrel gourd corn crisp chilly october november') },
      { title: 'Winter', words: list('snow ice frost sled skate mittens scarf coat boots blizzard igloo icicle fireplace cocoa penguin flake chill december january shovel') },
      { title: 'Trees', words: list('oak maple pine birch willow cedar spruce elm ash palm cherry cypress redwood sequoia fir aspen poplar magnolia beech juniper') },
      { title: 'Flowers', words: list('rose tulip daisy lily orchid violet iris poppy lilac peony daffodil sunflower marigold lavender jasmine dahlia petunia aster carnation zinnia') },
      { title: 'Weather', words: list('sunny cloudy rain storm thunder lightning wind breeze fog mist hail snow sleet drizzle tornado hurricane cyclone forecast humid temperature') },
    ],
  },
  holidays: {
    name: 'Holidays',
    topics: [
      { title: 'Christmas', words: list('santa reindeer sleigh elf stocking ornament wreath tinsel candycane gift present snowman carol bells mistletoe chimney holly star angel') },
      { title: 'Halloween', words: list('pumpkin ghost witch broom cauldron spider bat skeleton zombie vampire costume candy mask haunted moon owl cobweb lantern treat trick') },
      { title: 'Thanksgiving', words: list('turkey stuffing gravy cranberry pie harvest family feast grateful thankful pilgrim corn potato yams parade football gather blessing table autumn') },
      { title: 'Easter', words: list('bunny eggs basket chocolate chick lamb spring tulip lily hunt bonnet jellybean pastel candy sunday grass hop carrot daffodil celebrate') },
      { title: 'Valentines Day', words: list('love heart cupid arrow rose kiss hug valentine chocolate card candy honey romance red pink date darling adore friendship') },
      { title: 'New Year', words: list('midnight countdown fireworks confetti party resolution champagne toast cheers celebrate january calendar ball clock hope dream goal fresh start') },
    ],
  },
  sports: {
    name: 'Sports and Hobbies',
    topics: [
      { title: 'Sports', words: list('soccer baseball football basketball tennis golf hockey rugby cricket volleyball boxing swimming cycling skiing surfing rowing archery fencing karate wrestling') },
      { title: 'Olympic Games', words: list('medal gold silver bronze torch athlete podium sprint marathon relay hurdles javelin discus diving gymnast judo stadium record champion anthem') },
      { title: 'Gardening', words: list('soil seeds shovel rake hoe trowel compost mulch weeds water hose sprinkler bulbs roots harvest fence planter greenhouse fertilizer prune') },
      { title: 'Arts and Crafts', words: list('paint brush canvas easel crayon marker pencil glue scissors paper clay pottery knitting yarn sewing beads stencil collage sketch origami') },
      { title: 'Music', words: list('piano guitar violin cello flute trumpet drum harp saxophone clarinet melody rhythm tempo chord note song choir orchestra concert lyrics') },
      { title: 'Camping', words: list('tent campfire lantern sleepingbag marshmallow hiking trail compass map backpack canoe fishing forest stars cabin firewood flashlight canteen ranger lake') },
    ],
  },
  places: {
    name: 'Travel and Places',
    topics: [
      { title: 'Countries', words: list('canada mexico brazil peru chile france spain italy germany greece egypt kenya india china japan korea vietnam australia ireland norway') },
      { title: 'US States', words: list('alabama alaska arizona texas florida georgia ohio iowa idaho maine nevada oregon utah vermont virginia montana kansas hawaii colorado kentucky') },
      { title: 'World Capitals', words: list('paris london rome madrid berlin vienna athens cairo nairobi tokyo beijing delhi seoul lima ottawa canberra dublin oslo lisbon moscow') },
      { title: 'At the Airport', words: list('ticket passport luggage suitcase gate boarding pilot runway terminal security flight departure arrival customs baggage seat window aisle jet captain') },
      { title: 'At the Beach', words: list('sand shell wave tide surf towel umbrella bucket shovel castle seagull crab dune pier lifeguard sunscreen swimsuit kite boardwalk sunset') },
    ],
  },
  faith: {
    name: 'Bible',
    topics: [
      { title: 'Old Testament People', words: list('adam eve noah abraham sarah isaac jacob joseph moses aaron miriam joshua ruth naomi samuel david solomon elijah daniel esther') },
      { title: 'New Testament People', words: list('jesus mary joseph peter andrew james john matthew thomas philip paul timothy luke mark martha lazarus zacchaeus nicodemus barnabas silas') },
      { title: 'Books of the Bible', words: list('genesis exodus leviticus numbers joshua judges ruth samuel kings psalms proverbs isaiah jeremiah daniel jonah matthew mark luke john romans') },
      { title: 'Fruit of the Spirit', words: list('love joy peace patience kindness goodness loyalty gentleness selfcontrol grace hope mercy faith prayer blessing praise worship spirit light truth') },
      { title: 'Places in the Bible', words: list('eden egypt canaan jerusalem bethlehem nazareth galilee jordan jericho babylon nineveh sinai judea samaria rome corinth ephesus antioch damascus bethany') },
    ],
  },
  kids: {
    name: 'Easy Words for Kids',
    topics: [
      { title: 'Colors', words: list('red blue green yellow orange purple pink brown black white gray gold silver tan teal navy') },
      { title: 'Shapes', words: list('circle square triangle star heart oval diamond cube cone sphere line dot arrow cross moon') },
      { title: 'At School', words: list('book desk pencil crayon paper ruler glue bus teacher class lunch recess math read write art') },
      { title: 'My Body', words: list('head eyes ears nose mouth teeth hair arm hand finger leg knee foot toe neck back') },
      { title: 'Toys', words: list('ball doll kite yoyo blocks puzzle robot teddy train truck drum game top bike wagon car') },
      { title: 'At Home', words: list('bed lamp door chair table sofa rug clock sink bath cup plate spoon window stairs roof') },
    ],
  },
} satisfies Record<string, WordTheme>;

export type WordThemeId = keyof typeof WORD_THEMES;

export const WORD_THEME_IDS = Object.keys(WORD_THEMES) as WordThemeId[];

/** Words per puzzle for a square grid of this size */
export function wordsForGrid(size: number) {
  return Math.round(size * 1.25);
}

export interface ThemedWordSearch extends WordSearchResult {
  title: string;
}

/**
 * Word searches for a theme: topics in a seeded order (repeating once all are
 * used, with a different pick of words), sized for the grid.
 */
export function generateThemedWordSearches(themeId: WordThemeId, count: number, seed: string, size: number): ThemedWordSearch[] {
  const rng = new SeededRandom(`theme:${seed}`);
  const topics = rng.shuffle(WORD_THEMES[themeId].topics as WordTopic[]);
  return Array.from({ length: count }, (_, i) => {
    const topic = topics[i % topics.length];
    const fitting = topic.words.filter((w) => w.length <= size);
    const words = rng.shuffle(fitting).slice(0, wordsForGrid(size));
    return { title: topic.title, ...generateWordSearch(words, `${seed}:${i}`, size, size) };
  });
}
