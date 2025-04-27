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
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, utilities.remove('heatmapcolors', {})];
            case 1:
                _a.sent();
                //insert anitial heat map colors
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: ' Default Red/Green', key: 'default', min: { r: 63, g: 0, b: 0 }, max: { r: 0, g: 214, b: 0 } })];
            case 2:
                //insert anitial heat map colors
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'Grayscale', key: 'grayscale', min: { r: 0, g: 0, b: 0 }, max: { r: 200, g: 200, b: 200 } })];
            case 3:
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'Sunburst', key: 'sunburst', min: { r: 110, g: 8, b: 36 }, max: { r: 244, g: 179, b: 1 } })];
            case 4:
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'City Night', key: 'citynight', min: { r: 41, g: 10, b: 73 }, max: { r: 163, g: 196, b: 40 } })];
            case 5:
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'Inferno Twilight', key: 'infernotwilight', min: { r: 0, g: 0, b: 0 }, max: { r: 300, g: 100, b: 0 } })];
            case 6:
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'Lochmara', key: 'lochmara', min: { r: 2, g: 41, b: 110 }, max: { r: 253, g: 179, b: 56 } })];
            case 7:
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'Joker', key: 'joker', min: { r: 41, g: 94, b: 17 }, max: { r: 176, g: 18, b: 158 } })];
            case 8:
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'Orple', key: 'orple', min: { r: 81, g: 40, b: 136 }, max: { r: 235, g: 97, b: 35 } })];
            case 9:
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'Cotton Candy', key: 'cottoncandy', min: { r: 126, g: 41, b: 84 }, max: { r: 148, g: 203, b: 236 } })];
            case 10:
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'Steamship', key: 'steamship', min: { r: 0, g: 0, b: 80 }, max: { r: 200, g: 200, b: 200 } })];
            case 11:
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'Beach', key: 'beach', min: { r: 215, g: 150, b: 66 }, max: { r: 64, g: 176, b: 166 } })];
            case 12:
                _a.sent();
                return [4 /*yield*/, utilities.insert('heatmapcolors', { name: 'Moraine', key: 'moraine', min: { r: 93, g: 41, b: 10 }, max: { r: 40, g: 183, b: 216 } })];
            case 13:
                _a.sent();
                process.exit(0);
                return [2 /*return*/];
        }
    });
}); })();
// grayscale min(0,0,0), max(200,200,200)!
// default min(63,0,0),max(0,214,0)!
// blue to yellow min(2,81,150), max(253,179,56)!
// purple to orange min(81,40,136), max(235,97,35)!
// green to purple min(41,94,17), max(176,18,158)!
// brown to blue min(106,74,60), max(15,101,161)
// brick to yellow min(110,8,36), max(244,179,1)!
// tan to turquoise min(255,190,106), max(64,176,166)
// purple to sky min(126,41,84), max(148,203,236)!
//brown to teal min(73,41,10), max(40,203,236)
// purple to yellow min(41,10,73), max(203,236,40)!
//102 min(0,0,0), max(255,144,0)!
