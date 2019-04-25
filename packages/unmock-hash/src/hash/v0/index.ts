import objectHash from "object-hash";

export interface IHashableV0 {
    body: string | {};
    headers: {[key: string]: string};
    hostname: string;
    method: string;
    path: string;
    story: string[];
    user_id: string;
    signature?: string;
}

export interface IHashableWithIgnoreV0 {
  body?: string | {};
  headers?: {[key: string]: string};
  hostname?: string;
  method?: string;
  path?: string;
  story?: string[];
  user_id?: string;
  signature?: string;
}

export interface IIgnoreObjectV0 {
  body?: string;
  headers?: string | string[] | {[key: string]: string};
  hostname?: string;
  method?: string;
  path?: string;
  story?: string | string[];
  user_id?: string;
  signature?: string;
}

export type IgnoreFieldV0 = "body" | "headers" | "hostname" | "method" | "path" | "story" | "user_id" | "signature";
export type SingleIgnoreV0 = IIgnoreObjectV0 | IgnoreFieldV0;
export type IgnoreV0 = SingleIgnoreV0 | SingleIgnoreV0[];

export const makeHashable = (initialInput: IHashableV0, bigIgnore: IgnoreV0): IHashableWithIgnoreV0 => {
  const out = {
    ...initialInput,
    headers: {...initialInput.headers},
    story: [...initialInput.story],
  };
  if (!(bigIgnore instanceof Array)) {
    bigIgnore = [bigIgnore];
  }
  for (const ignore of bigIgnore) {
    if (ignore === "body") {
      delete out.body;
    } else if (typeof ignore !== "string" &&
      ignore.body &&
      typeof out.body === "string" &&
      new RegExp(ignore.body).test(out.body)) {
      delete out.body;
    } else if (ignore === "hostname") {
      delete out.hostname;
    } else if (typeof ignore !== "string" &&
      ignore.hostname &&
      new RegExp(ignore.hostname).test(out.hostname)) {
      delete out.hostname;
    } else if (ignore === "method") {
      delete out.method;
    } else if (typeof ignore !== "string" &&
      ignore.method &&
      new RegExp(ignore.method).test(out.method)) {
      delete out.method;
    } else if (ignore === "path") {
      delete out.path;
    } else if (typeof ignore !== "string" &&
      ignore.path &&
      new RegExp(ignore.path).test(out.path)) {
      delete out.path;
    } else if (ignore === "user_id") {
      delete out.user_id;
    } else if (typeof ignore !== "string" &&
      ignore.user_id &&
      new RegExp(ignore.user_id).test(out.user_id)) {
      delete out.user_id;
    } else if (ignore === "signature") {
      delete out.signature;
    } else if (typeof ignore !== "string" &&
      ignore.signature &&
      out.signature &&
      new RegExp(ignore.signature).test(out.signature)) {
      delete out.signature;
    } else if (ignore === "story") {
      delete out.story;
    } else if (typeof ignore !== "string" && ignore.story) {
      out.story = out.story.filter((story) =>
            !(typeof ignore.story === "string" &&
              new RegExp(ignore.story).test(story)) &&
            !(ignore.story instanceof Array &&
              ignore.story.filter((sub) => new RegExp(sub).test(story)).length > 0));
    } else if (ignore === "headers") {
      delete out.headers;
    } else if (typeof ignore !== "string" && ignore.headers) {
      out.headers = Object.keys(out.headers).filter((header) =>
            !(typeof ignore.headers === "string" &&
              new RegExp(ignore.headers).test(header)) &&
            !(ignore.headers instanceof Array &&
              ignore.headers.filter((sub) => new RegExp(sub).test(header)).length > 0) &&
              !((typeof ignore.headers === "object") && !(ignore.headers instanceof Array) &&
                Object.entries(ignore.headers).filter(([k, v]) => k === header
                  && new RegExp(v).test(header)).length > 0))
          .map((k) => ({ [k]: out.headers[k]}))
          .reduce((a, b) => ({ ...a, ...b}), {});
    }
  }
  return out;
};

const TRUNCATE_HASH_AT = 8;

export default (initialInput: IHashableV0, ignore?: IgnoreV0) =>
  objectHash(ignore ? makeHashable(initialInput, ignore) : initialInput).substring(0, TRUNCATE_HASH_AT);