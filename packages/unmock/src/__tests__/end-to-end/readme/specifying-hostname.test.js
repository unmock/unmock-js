const unmock = require("unmock");
const { u } = unmock;

unmock
  .mock("http://www.example.com")
  .get("/resource")
  .reply(200, u.integer());

async function verifyReadme() {
  const result = await unmock.fetch("http://www.example.com/resource/");
  const text = await result.text();
  return parseInt(text);
}

beforeAll(() => unmock.default.on());
afterAll(() => unmock.default.off());

describe("verifyReadme", () => {
  it("makes sure the readme works", async () => {
    const res = await verifyReadme();
    expect(typeof res).toBe("number");
    expect(Math.floor(res)).toBe(res);
  });
});
