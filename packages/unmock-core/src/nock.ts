import * as io from "io-ts";
import { cnst_, extendT, tuple_, type_ } from "json-schema-poet";
import {
  JSONArray,
  JSONObject,
  JSONPrimitive,
  JSONSchemaObject,
  JSSTAllOf,
  JSSTAnyOf,
  JSSTAnything,
  JSSTEmpty,
  JSSTList,
  JSSTNot,
  JSSTObject,
  JSSTOneOf,
  JSSTTuple,
} from "json-schema-strictly-typed";
import NodeBackend from "./backend";
import { HTTPMethod } from "./interfaces";
import { Schema } from "./service/interfaces";
import { ServiceStore } from "./service/serviceStore";

// Used to differentiate between e.g. `{ foo: { type: "string" } }` as a literal value
// (i.e. key `foo` having the value of `{type: "string"}`) and a dynamic JSON schema
const DynamicJSONSymbol: unique symbol = Symbol();
interface IDynamicJSONValue {
  dynamic: typeof DynamicJSONSymbol;
}
const isDynamic = (unk: unknown): unk is IDynamicJSONValue =>
  typeof unk === "object" && (unk as any).dynamic === DynamicJSONSymbol;
const DynamicJSONValue: io.Type<
  IDynamicJSONValue,
  IDynamicJSONValue
> = new io.Type<IDynamicJSONValue, IDynamicJSONValue>(
  "DynamicJSONValueType",
  isDynamic,
  (input, context) =>
    isDynamic(input) ? io.success(input) : io.failure(input, context),
  io.identity,
);

const RecursiveUnion: io.Type<
RecursiveUnionType,
RecursiveUnionType
> = io.recursion("JSO", () => io.union([
  JSONPrimitive, JSONObject, JSONArray, ExtendedArray, ExtendedObject
]));
const JSO: io.Type<
ExtendedJSONSchema,
ExtendedJSONSchema
> = io.recursion("JSO", () => JSONSchemaObject(RecursiveUnion, DynamicJSONValue));

type RecursiveUnionType = JSONPrimitive | JSONObject | JSONArray | IExtendedArrayType | IExtendedObjectType;

// Define json schema types extended with the dynamic json value property
type ExtendedJSONSchema = JSONSchemaObject<
  RecursiveUnionType,
  IDynamicJSONValue
>;
type ExtendedPrimitiveType = JSONPrimitive | ExtendedJSONSchema;
type ExtendedValueType =
  | ExtendedPrimitiveType
  | IExtendedArrayType
  | IExtendedObjectType
  | JSONArray
  | JSONObject;
interface IExtendedObjectType extends Record<string, ExtendedValueType> {} // Defined as interface due to circular reasons
interface IExtendedArrayType extends Array<ExtendedValueType> {} // Defined as interface due to circular reference

// Define matching codecs for the above types
const ExtendedPrimitive = io.union([JSONPrimitive, JSO]);
const ExtendedValue: io.Type<
  ExtendedValueType,
  ExtendedValueType
> = io.recursion("ExtendedValue", () =>
  io.union([
    ExtendedPrimitive,
    JSONArray,
    JSONObject,
    ExtendedObject,
    ExtendedArray,
  ]),
);
const ExtendedObject: io.Type<
  IExtendedObjectType,
  IExtendedObjectType
> = io.recursion("ExtendedObject", () => io.record(io.string, ExtendedValue));
const ExtendedArray: io.Type<
  IExtendedArrayType,
  IExtendedArrayType
> = io.recursion("ExtendedArray", () => io.array(ExtendedValue));

// hack until we get around to doing full typing :-(
const removeDynamicSymbol = (
  schema: any,
): JSONSchemaObject<JSSTEmpty<{}>, {}> => {
  if (schema instanceof Array) {
    return schema.map(removeDynamicSymbol) as unknown as JSONSchemaObject<JSSTEmpty<{}>, {}>;
  }
  if (typeof schema === "object") {
    const { dynamic, ...rest } = schema;
    return Object.entries(rest)
      .reduce((a, b) =>
        ({ ...a, [b[0]]: removeDynamicSymbol(b[1])}), {}) as unknown as JSONSchemaObject<JSSTEmpty<{}>, {}>;
  }
  return schema;
};

const JSONSchemify = (e: ExtendedValueType): JSSTAnything<JSSTEmpty<{}>, {}> =>
  isDynamic(e)
    ? removeDynamicSymbol(
        // we cover all of the nested cases,
        // followed by un-nested cases
        JSSTAllOf(RecursiveUnion, DynamicJSONValue).is(e)
          ? { ...e, allOf: e.allOf.map(JSONSchemify) }
          : JSSTAnyOf(RecursiveUnion, DynamicJSONValue).is(e)
          ? { ...e, anyOf: e.anyOf.map(JSONSchemify) }
          : JSSTOneOf(RecursiveUnion, DynamicJSONValue).is(e)
          ? { ...e, oneOf: e.oneOf.map(JSONSchemify) }
          : JSSTNot(RecursiveUnion, DynamicJSONValue).is(e)
          ? { ...e, not: JSONSchemify(e.not) }
          : JSSTList(RecursiveUnion, DynamicJSONValue).is(e)
          ? { ...e, items: JSONSchemify(e.items) }
          : JSSTTuple(RecursiveUnion, DynamicJSONValue).is(e)
          ? { ...e, oneOf: e.items.map(JSONSchemify) }
          : JSSTObject(RecursiveUnion, DynamicJSONValue).is(e)
          ? {
              ...e,
              ...(e.additionalProperties ? {additionalProperties: JSONSchemify(e.additionalProperties)} : {}),
              ...(e.patternProperties ? {patternProperties: Object.entries(e.patternProperties).reduce((a,b) => ({ ...a, [b[0]]: JSONSchemify(b[1])}), {})} : {}),
              ...(e.properties ? {properties: Object.entries(e.properties).reduce((a,b) => ({ ...a, [b[0]]: JSONSchemify(b[1])}), {})} : {})
            }
          : e
      )
    : ExtendedArray.is(e) || JSONArray.is(e)
    ? tuple_<JSSTEmpty<{}>, {}>({})(
        e.map(JSONSchemify),
      )
    : ExtendedObject.is(e) || JSONObject.is(e)
    ? type_<JSSTEmpty<{}>, {}>({})(
        Object.entries(e).reduce(
          (a, b) => ({ ...a, [b[0]]: JSONSchemify(b[1]) }),
          {},
        ),
        {},
      )
    : cnst_<{}>({})(e);

// Define poet to recognize the new "dynamic type"
const jspt = extendT<ExtendedJSONSchema, IDynamicJSONValue>({
  dynamic: DynamicJSONSymbol,
});

export const u = jspt;

// Defined nock-like syntax to create/update a service on the fly
type UpdateCallback = ({
  statusCode,
  data,
}: {
  statusCode: number;
  data: Schema;
}) => ServiceStore;

// Placeholder for poet input type, to have
// e.g. standard object => { type: "object", properties: { ... }}, number => { type: "number", const: ... }
type Primitives = string | number | boolean;
type InputToPoet = { [k: string]: any } | Primitives | Primitives[];

export class DynamicServiceSpec {
  private data: Schema = {};

  // Default status code passed in constructor
  constructor(
    private updater: UpdateCallback,
    private statusCode: number = 200,
    private baseUrl: string,
    private name?: string,
  ) {}

  // TODO: Should this allow fluency for consecutive .get, .post, etc on the same service?
  public reply(
    statusCode: number,
    data?: InputToPoet | InputToPoet[],
  ): FluentDynamicService;
  public reply(data: InputToPoet | InputToPoet[]): FluentDynamicService;
  public reply(
    maybeStatusCode: number | InputToPoet | InputToPoet[],
    maybeData?: InputToPoet | InputToPoet[],
  ): FluentDynamicService {
    if (maybeData !== undefined) {
      this.data = JSONSchemify(maybeData) as Schema;
      this.statusCode = maybeStatusCode as number;
    } else if (
      typeof maybeStatusCode === "number" &&
      maybeStatusCode >= 100 &&
      maybeStatusCode < 599
    ) {
      // we assume it's a status code
      this.statusCode = maybeStatusCode;
    } else {
      this.data = JSONSchemify(maybeStatusCode) as Schema;
    }
    const store = this.updater({
      data: this.data,
      statusCode: this.statusCode,
    });

    return buildFluentNock(store, this.baseUrl, this.name);
  }
}

type FluentDynamicService = {
  [k in HTTPMethod]: (endpoint: string) => DynamicServiceSpec;
};

const buildFluentNock = (
  store: ServiceStore,
  baseUrl: string,
  name?: string,
): FluentDynamicService => {
  const dynFn = (method: HTTPMethod, endpoint: string) => ({
    statusCode,
    data,
  }: {
    statusCode: number;
    data: Schema;
  }) =>
    store.updateOrAdd({
      baseUrl,
      method,
      endpoint: endpoint.startsWith("/") ? endpoint : `/${endpoint}`,
      statusCode,
      response: data,
      name,
    });
  return Object.entries({
    get: 200,
    head: 200,
    post: 201,
    put: 204,
    patch: 204,
    delete: 200,
    options: 200,
    trace: 200,
  }).reduce(
    (o, [method, code]) => ({
      ...o,
      [method]: (endpoint: string) =>
        new DynamicServiceSpec(
          dynFn(method as HTTPMethod, endpoint),
          code,
          baseUrl,
          name,
        ),
    }),
    {},
  ) as FluentDynamicService;
};

export const nockify = ({
  backend,
  baseUrl,
  name,
}: {
  backend: NodeBackend;
  baseUrl: string;
  name?: string;
}) => buildFluentNock(backend.serviceStore, baseUrl, name);
