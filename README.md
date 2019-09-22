[![CircleCI](https://circleci.com/gh/unmock/unmock-js.svg?style=svg)](https://circleci.com/gh/unmock/unmock-js)
[![codecov](https://codecov.io/gh/unmock/unmock-js/branch/dev/graph/badge.svg)](https://codecov.io/gh/unmock/unmock-js)
[![Known Vulnerabilities](https://snyk.io/test/github/unmock/unmock-js/badge.svg?targetFile=package.json)](https://snyk.io/test/github/unmock/unmock-js?targetFile=package.json)

# Unmock

Mock API dependencies in JavaScript.

## Install

```sh
$ npm install --save-dev unmock
```

## Usage

Unmock has great [documentation](https://unmock.io/docs/introduction), but this README contains all the essential information.

Here is a simple mock, a simple function, and a simple test in jest.

```js
const unmock = require("unmock");
const { nock, runner, transform, u } = unmock;
const { withCodes } = transform;

nock("https://zodiac.com", "zodiac")
  .get("/horoscope/{sign}")
  .reply(200, {
    horoscope: u.string(),
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
    runner(async () => {
      zodiac.spy.resetHistory();
      zodiac.state(withCodes(200));
      const res = await getHoroscope();
      expect(res).toMatchObject(JSON.parse(zodiac.spy.getResponseBody()));
      expect(res.seen).toBe(false);
    }),
  );
});
```

This setup says that we will intercept every HTTP call to `https://zodiac.com`.

It will intercept all HTTPS GET requests to `/horoscope/{sign}`. We instruct it to reply with a status 200, and the body will contain a response in JSON corresponding to the spec.

### Specifying hostname

The request hostname should be a string.

```js
unmock.nock('http://www.example.com')
  .get('/resource')
  .reply(200, u.integer())
```

Unmock will then refer to the service as `example`. To specify the name of the service as `foo`, we would write.

```js
unmock.nock('http://www.example.com', 'foo')
  .get('/resource')
  .reply(200, u.string())
```

To match multiple protocols or URLs, use `associate`.

```js
unmock.associate('https://www2.example.com', 'foo')
```

### Specifying path

The request path should be a string, and you can use any [HTTP verb](#http-verbs). Wild-cards in the string should be enclosed in curly braces.

```js
unmock.nock('http://www.example.com')
  .get('/resource/{id}')
  .reply(200, u.string())
```

Alternatively, you can use an array of path segments, where each segment is either a string, a string in curly-braces for an open parameter, or a key/value pair associating a name of a path parameter to a regex matching it.

```js
const scope = nock('http://www.example.com')
  .get(["users", /[0-9]+/, "status"]) // "/users/{id}/status"
  .reply(200, u.string())
```

### Specifying request body

You can specify the request body to be matched as the second argument to the `get`, `post`, `put` or `delete` specifications. The argument can be any valid JSON, [`json-schema-poet`](https://github.com/unmock/json-schema-poet) using the `u` syntax(`u.integer()`, `u.string()`) or any combination thereof.

Here is an example of a simple string.

```js
unmock.nock('http://www.example.com')
  .post('/login', 'username=pgte&password=123456')
  .reply(200, { id: u.string() })
```

Here is an example of a more complicated structure, using `u.type` to specify required and optional properties.

```js
unmock.nock('http://www.example.com')
  .post('/login', u.type({ token: u.string()}, {expires: u.integer()})
  .reply(200, { id: u.string() })
```

```js
unmock.nock('http://www.example.com')
  .post('/login', { token: u.string(), expires: u.integer() })
  .reply(200, { id: u.string() })
```

### Specifying request query string

Unmock automatically ignores query strings. However, it understands query strings if you would like to match against them.

> You should avoid matching against query strings, as they will act as required. Most APIs do not have required query strings. If you want to use query strings to compose the return value of an API, use the `state`.

These parameters can be included as part of the path:

```js
unmock.nock('http://example.com')
  .get('/users?foo=bar')
  .reply(200)
```

Instead of placing the entire URL, you can specify the query part as an object:

```js
unmock.nock('http://example.com')
  .get('/users')
  .query({ name:u.string(), surname: u.string() })
  .reply(200, { results: u.array({id: u.integer() }) })
```

### Specifying replies

You can specify the return status code for a path on the first argument of reply like this:

```js
unmock.nock('http://myapp.iriscouch.com')
  .get('/users/1')
  .reply(404)
```

You can also specify the reply body as valid JSON, JSON schema, or any combination thereof.

```js
unmock.nock('http://www.google.com')
  .get('/')
  .reply(200, u.stringEnum(['Hello from Google!', 'Do no evil']))
```

### Specifying headers

#### Header field names are case-insensitive

Per [HTTP/1.1 4.2 Message Headers](http://www.w3.org/Protocols/rfc2616/rfc2616-sec4.html#sec4.2) specification, all message headers are case insensitive and thus internally Nock uses lower-case for all field names even if some other combination of cases was specified either in mocking specification or in mocked requests themselves.

#### Specifying Request Headers

You can specify the request headers like this:

```js
unmock.nock('http://www.example.com', {
  reqheaders: {
    authorization: 'Basic Auth',
  },
})
  .get('/')
  .reply(200)
```

Or you can use a regular expression to check the header values.

```js
const scope = nock('http://www.example.com', {
  reqheaders: {
    'X-My-Awesome-Header': /Awesome/i,
  },
})
  .get('/')
  .reply(200)
```

Headers in unmock are always a partial match, meaning that additional headers are ignored. This means that you don't need to worry about matching against common headers like `Content-Type` and `Host`.

#### Specifying Reply Headers

You can specify the reply headers like this:

```js
unmock.nock('https://api.github.com')
  .get('/repos/atom/atom/license')
  .reply(200, { license: 'MIT' }, { 'X-RateLimit-Remaining': u.integer() })
```

### Chaining

You can chain behavior like this:

```js
unmock. nock('http://myapp.iriscouch.com')
  .get('/users/1')
  .reply(404)
  .post('/users', {
    username: u.string(),
    email: u.string(),
  })
  .reply(201, {
    ok: u.boolean(),
    id: u.string(),
    rev: u.string(),
  })
  .get('/users/123ABC')
  .reply(200, {
    _id: u.string(),
    _rev: u.string(),
    user: u.string(),
    name: u.string()
  })
```

### Passthrough

For "boring" API calls where you are just passing through information, you can instruct unmock to serve random `200` resposnes to those requests using `passthrough`.

```js
unmock
  .nock("https://my-analytics-api.vendor.com)
  .passthrough();
```

## Expectations

Unmock uses [`sinon`](https://sinonjs.org) spies to help you compose (great) expectations.

> In general, try to write expectations using spies instead of hardcoded values. Instead of `expect(res).toEqual({foo: "bar", baz: true })`, favor `expect(res).toEqual({ ...spy.getRequestBody(), baz: true })`

Assuming you have defined a service using unmock, you can use spies following the `<verb><Request|Response><Thing>` convention. For example, `getResponseBody` or `deleteRequestPath`. Nonsensical things like `getRequsetBody` are not defined.

```js
test("analytics API was called", async () => {
  await myFunction()
  expect(analyticsService.spy.postRequestBody())
    .toMatchObject({ event: "VISITED" })
})
```

The following getter functions are defined on the spy object.

- `getRequestPathname`
- `getRequestPath`
- `getRequestHeaders`
- `getRequestQuery`
- `getRequestProtocol`
- `getResponseBody`
- `getResponseCode`
- `getResponseHeaders`
- `headRequestPathname`
- `headRequestPath`
- `headRequestHeaders`
- `headRequestQuery`
- `headRequestProtocol`
- `headResponseBody`
- `headResponseCode`
- `headResponseHeaders`
- `postRequestBody`
- `postRequestPathname`
- `postRequestPath`
- `postRequestHeaders`
- `postRequestQuery`
- `postRequestProtocol`
- `postResponseBody`
- `postResponseCode`
- `postResponseHeaders`
- `putRequestBody`
- `putRequestPathname`
- `putRequestPath`
- `putRequestHeaders`
- `putRequestQuery`
- `putRequestProtocol`
- `putResponseBody`
- `putResponseCode`
- `putResponseHeaders`
- `patchRequestBody`
- `patchRequestPathname`
- `patchRequestPath`
- `patchRequestHeaders`
- `patchRequestQuery`
- `patchRequestProtocol`
- `patchResponseBody`
- `patchResponseCode`
- `patchResponseHeaders`
- `deleteRequestPathname`
- `deleteRequestPath`
- `deleteRequestHeaders`
- `deleteRequestQuery`
- `deleteRequestProtocol`
- `deleteResponseBody`
- `deleteResponseCode`
- `deleteResponseHeaders`
- `optionsRequestPathname`
- `optionsRequestPath`
- `optionsRequestHeaders`
- `optionsRequestQuery`
- `optionsRequestProtocol`
- `optionsResponseBody`
- `optionsResponseCode`
- `optionsResponseHeaders`
- `traceRequestPathname`
- `traceRequestPath`
- `traceRequestHeaders`
- `traceRequestQuery`
- `traceRequestProtocol`
- `traceResponseBody`
- `traceResponseCode`
- `traceResponseHeaders`

In addition, spies are full-fledged sinon spies. More about their usage in Unmock can be found [here](https://www.unmock.io/docs/expectations), and more information on sinon can be found [here](https://sinonjs.org/).

## Runner

The unmock runner runs the same test multiple times with different potential outcomes from the API. All of your unmock tests should use the `runner` unless you are absolutely certain that the API response will be the same every time.

```js
const { runner } = "unmock";
test("my API always works as expected", runner(async () => {
  const res = await myApiFunction();
  // some expectations
}));
```

## OpenAPI

Unmock supports the reading of OpenAPI specifications out of the box. Simply place your specification in a folder at the root of your project called `__unmock__/<myspecname>`, where `<myspecname>` is the name of the spec on the `unmock.on().services` object.  Several examples of this exist on the internet, most notably [here](https://github.com/unmock/unmock-examples/tree/master/using-service-repository).

## Contributing

Thanks for wanting to contribute! Take a look at our [Contributing Guide](CONTRIBUTING.md) for notes on our commit message conventions and how to run tests.

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md).
By participating in this project you agree to abide by its terms.

## Development

- See [publish.md](./publish.md) for instructions how to make a new release

## License

[MIT](LICENSE)

Copyright (c) 2018–2019 [Meeshkan](http://meeshkan.com) and other [contributors](https://github.com/unmock/unmock-js/graphs/contributors).
