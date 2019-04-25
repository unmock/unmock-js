/**
 * @jest-environment node
 */

import axios from "axios";
import fs from "fs";
import { kcomnu, unmock } from "../";

beforeEach(async () => {
  require("dotenv").config();
  const CREDENTIALS = `[unmock]\ntoken=${process.env.UNMOCK_TOKEN}\n`;
  fs.writeFileSync(".unmock/credentials", CREDENTIALS);
  await unmock({
    ignore: "story",
    save: true,
    unmockHost: process.env.UNMOCK_HOST,
    unmockPort: process.env.UNMOCK_PORT,
  });
});

afterEach(async () => {
  await kcomnu();
});

test("credentials written to .unmock/credentials work just like a token", async () => {
  const {
    data: { projects },
  } = await axios(
    "https://www.behance.net/v2/projects?api_key=u_n_m_o_c_k_200",
  );
  expect(typeof projects[0].id).toBe("number");
  // test to make sure cache works
  const {
    data,
  } = await axios(
    "https://www.behance.net/v2/projects?api_key=u_n_m_o_c_k_200",
  );
  expect(typeof data.projects[0].id).toBe("number");
});