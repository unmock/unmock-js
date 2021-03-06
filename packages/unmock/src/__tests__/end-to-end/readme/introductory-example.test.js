const unmock = require("unmock");
const { mock, transform, u } = unmock;
const { withCodes } = transform;
const jestRunner = require("unmock-jest-runner").default;

mock("https://zodiac.com", "zodiac")
  .get("/horoscope/{sign}")
  .reply(200, {
    horoscope: u.string(),
    ascendant: u.opt(u.string()),
  })
  .reply(404, { message: "Not authorized" });

async function getHoroscope(sign) {
  // use unmock.fetch, request, fetch, axios or any similar library
  const result = await unmock.fetch("https://zodiac.com/horoscope/" + sign);
  const json = await result.json();
  return { ...json, seen: false };
}

let zodiac;
beforeAll(() => {
  zodiac = unmock.default.on().services.zodiac;
});
afterAll(() => unmock.default.off());

describe("getHoroscope", () => {
  it(
    "augments the API call with seen=false",
    jestRunner(async () => {
      zodiac.spy.resetHistory();
      zodiac.state(withCodes(200));
      const res = await getHoroscope();
      expect(res).toMatchObject(JSON.parse(zodiac.spy.getResponseBody()));
      expect(res.seen).toBe(false);
    }),
  );
});
