"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env.TIER = 'dev';
var utilities = require('scoutradioz-utilities');
utilities.config(require('../databases.json'), {
    cache: {
        enable: true,
        maxAge: 30
    },
    debug: true,
});
// @ts-ignore
utilities.refreshTier();
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var schemaArr, _i, schemaArr_1, schema, _a, _b, item, org_key, writeResult, schema_id, orgSchema;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, utilities.aggregate('layout', [
                    {
                        '$sort': {
                            'order': 1
                        }
                    }, {
                        '$group': {
                            '_id': {
                                'org_key': '$org_key',
                                'form_type': '$form_type',
                                'year': '$year'
                            },
                            'layout': {
                                '$push': {
                                    'type': '$type',
                                    'id': '$id',
                                    'label': '$label',
                                    'operations': '$operations',
                                    'options': '$options',
                                    'formula': '$formula',
                                }
                            }
                        }
                    }, {
                        '$project': {
                            'year': '$_id.year',
                            'last_modified': '$$NOW',
                            'created': '$$NOW',
                            'form_type': '$_id.form_type',
                            'layout': 1,
                            'name': '',
                            'description': '',
                            'published': {
                                '$literal': false
                            },
                            'owners': [
                                '$_id.org_key'
                            ],
                            '_id': 0
                        }
                    }, {
                        '$sort': {
                            'owners': 1,
                            'year': 1,
                            'form_type': 1
                        }
                    }
                ])];
            case 1:
                schemaArr = _c.sent();
                return [4 /*yield*/, utilities.remove('schemas', {})];
            case 2:
                _c.sent();
                return [4 /*yield*/, utilities.remove('orgschemas', {})];
            case 3:
                _c.sent();
                _i = 0, schemaArr_1 = schemaArr;
                _c.label = 4;
            case 4:
                if (!(_i < schemaArr_1.length)) return [3 /*break*/, 8];
                schema = schemaArr_1[_i];
                for (_a = 0, _b = schema.layout; _a < _b.length; _a++) {
                    item = _b[_a];
                    // @ts-ignore
                    if (item.type === 'h2')
                        item.type = 'header';
                    // @ts-ignore
                    if (item.type === 'h3')
                        item.type = 'subheader';
                    // @ts-ignore
                    if (item.type === 'counter') {
                        item.variant = 'standard';
                        item.allow_negative = false;
                    }
                    // @ts-ignore
                    if (item.type === 'badcounter') {
                        item.type = 'counter';
                        item.variant = 'bad';
                        item.allow_negative = false;
                    }
                    // @ts-ignore
                    if (item.type === 'counterallownegative') {
                        item.type = 'counter';
                        item.variant = 'standard';
                        item.allow_negative = true;
                    }
                    if (item.type === 'slider') {
                        item.variant = 'standard';
                    }
                    // @ts-ignore
                    if (item.type === 'timeslider') {
                        item.type = 'slider';
                        item.variant = 'time';
                    }
                }
                org_key = schema.owners[0];
                schema.name = "".concat(org_key, "'s ").concat(schema.form_type, " Form from ").concat(schema.year);
                schema.description = 'Autogenerated during the 2025 season schema update';
                return [4 /*yield*/, utilities.insert('schemas', schema)];
            case 5:
                writeResult = _c.sent();
                console.log(writeResult);
                schema_id = writeResult.insertedId;
                orgSchema = {
                    org_key: org_key,
                    year: schema.year,
                    form_type: schema.form_type,
                    schema_id: schema_id,
                };
                return [4 /*yield*/, utilities.insert('orgschemas', orgSchema)];
            case 6:
                writeResult = _c.sent();
                console.log(writeResult);
                _c.label = 7;
            case 7:
                _i++;
                return [3 /*break*/, 4];
            case 8:
                process.exit(0);
                return [2 /*return*/];
        }
    });
}); })();
