/**
 * Modal dialog element with a close button.
 */
declare class Dialog {
    static getDialog(): JQuery<HTMLDialogElement>;
    /**
     * Open the modal dialog and populate its body with the HTML that you specify.
     * @param html The HTML to populate the dialog with. Need to fetch it ahead of time with a `fetch` statement.
     *
     * @example
     *
     * 		fetch('/url'), { method: 'GET' })
     * 			.then(response => response.text())
     * 			then(data => Dialog.show(data));
     */
    static show(html: string): void;
    /**
     * Open the modal dialog and populate it with the URL you specified.
     * The web request will set the InModalDialog to true automatically, disabling the page heaader.
     * @param url URL to open
     */
    static showURL(url: string): void;
}
declare class FormSubmission {
    /**
     * JL note 2022-04-03: Since all uses of FormSubmission follow the following response system:
     * 	{
     * 		status: number,
     * 		message: string
     * 	}
     * and it is convenient to keep the usage consistent across all usage of FormSubmissions, it should now be enforced.
     * In the routes, do res.send({status: <number>, message: <string>}) for anything that uses a FormSubmission.
     * 	Use 200 for success statuses.
     */
    data: Dictionary<any>;
    url: string;
    key: string;
    options: {
        autoRetry: boolean;
    };
    /**
     * Generic form submission that uses NotificationCards.
     * @param {HTMLFormElement|JQuery} form Form to submit
     * @param {String} url POST URL to submit to
     * @param {String} key Name of form (any)
     * @param {object} [options]
     * @param {boolean} [options.autoRetry=true] Whether to auto retry.
     */
    constructor(form: HTMLFormElement | JQuery, url: string, key: string, options?: {
        autoRetry: boolean;
    });
    /**
     * Submit the formsubmission.
     * @param {ObjectCallback} cb Callback function. (err, response)
     */
    submit(cb: ObjectCallback): void;
    _getFromLocalStorage(): string | null;
    _addToLocalStorage(): void;
    /**
     * Get a key-value object from any form element (useful outside of the FormSubmission class)
     */
    static getFormData(form: HTMLFormElement | JQuery): Dictionary<string>;
}
interface ObjectCallback {
    (error: JQueryXHR | Error | string | null, response?: SRResponse): void;
}
declare class SRResponse {
    status: number;
    message: string;
}
interface Dictionary<T> {
    [Key: string]: T;
}
declare let navMenu: NavigationBar;
declare class NavigationBar {
    opened: boolean;
    moving: boolean;
    panning: boolean;
    pendingAnimationFrame: boolean;
    menuElem: JQuery;
    barElem: JQuery;
    overlayElem: JQuery;
    title: string;
    footerContents: Array<string>;
    locales: Array<Locale>;
    opts: {
        openingInterval: number;
        fastTransitionTime: number;
        slowTransitionTime: number;
        slowTransition: string;
        fastTransition: string;
        panThreshold: number;
    };
    menu: any;
    api: any;
    constructor();
    eventHandlers(): void;
    preMenuOpen(): void;
    menuOpen(): void;
    postMenuOpen(): void;
    preMenuClose(): void;
    menuClose(): void;
    postMenuClose(): void;
    calculateTransformPosition(percentageOpened: number): TransformPosition;
}
declare class TransformPosition {
    menu: string;
    bar: string;
}
interface Locale {
    lang: string;
    name: string;
    dir: 'ltr' | 'rtl';
}
declare let navMenuTitle: string | undefined;
declare let footerContents: Array<string> | undefined;
declare let locales: Array<Locale> | undefined;
declare let Mmenu: any;
declare class NotificationCard {
    text: string;
    opts: any;
    card: JQuery;
    _textContent: JQuery | undefined;
    darkener: JQuery | undefined;
    /**
     * @param {string} text Text to display on notification card
     * @param {object} [options] Optional settings
     * @param {string} [options.type=undefined] Type of card to show (success, warn, error)
     * @param {number} [options.ttl=2000] Time-to-live of notification card.
     * @param {boolean} [options.darken=false] Whether card darkens/disabled entire screen when it is shown.
     * @param {boolean} [options.exitable=false] Whether card has an exit button.
     * @param {function} [options.onexit=undefined] Callback for when a user clicks the exit button.
     */
    constructor(text: string, options?: NotificationCardOptions);
    /**
     * Static method to create and return a new NotificationCard with specified options.
     * @param {String} text Text to display on notification card
     * @param {object} [options] Optional settings
     * @param {string} [options.type=undefined] Type of card to show (success, warn, error)
     * @param {number} [options.ttl=2000] Time-to-live of notification card.
     * @param {boolean} [options.darken=false] Whether card darkens/disabled entire screen when it is shown.
     * @param {boolean} [options.exitable=false] Whether card has an exit button.
     * @param {function} [options.onexit=undefined] Callback for when a user clicks the exit button.
     * @return {NotificationCard} The new NotificationCard object.
     */
    static show(text: string, opts?: NotificationCardOptions | undefined): NotificationCard;
    /**
     * Shorthand to display an error/bad notification card.
     * @param {string} text Text to display.
     * @param {object} [options] Optional settings. See NotificationCard constructor for detailed docs.
     */
    static error(text: string, opts?: NotificationCardOptions): NotificationCard;
    /**
     * Shorthand to display a good/success notification card.
     * @param {string} text Text to display.
     * @param {object} [options] Optional settings. See NotificationCard constructor for detailed docs.
     */
    static good(text: string, opts?: NotificationCardOptions): NotificationCard;
    /**
     * Shorthand to display a warning notification card.
     * @param {string} text Text to display.
     * @param {object} [options] Optional settings. See NotificationCard constructor for detailed docs.
     */
    static warn(text: string, opts?: NotificationCardOptions): NotificationCard;
    /**
     * Gets and creates static container element for all notification cards.
     * @return {JQuery} Parent element that contains all notification cards.
     */
    static container(): JQuery<HTMLElement>;
    /**
     * Display the card.
     */
    show(): this;
    /**
     * Change the text of the notification card.
     * @param {string} newText New text to show.
     */
    setText(newText: string): void;
    /**
     * Remove the card from the document.
     * @param {Number} time (Optional) Fade-out card with given time interval. (Default: 0ms, no fade)
     */
    remove(time?: number): this;
    _filterOptions(options: NotificationCardOptions): NotificationCardOptions;
    _enrichText(): JQuery;
    static _enrichHyperlinkTags(html: string): JQuery<HTMLSpanElement>;
    static _enrichWithClosingTags(html: string, key: string, openTag: string, closeTag: string): JQuery<HTMLSpanElement>;
    static _enrichWithSelfClosingTags(html: string, key: string, tag: string): JQuery<HTMLSpanElement>;
}
declare class NotificationCardOptions {
    sprite?: string;
    type?: string | undefined | null;
    ttl?: number | undefined | null;
    exitable?: boolean | undefined | null;
    darken?: boolean | undefined | null;
    onexit?: (() => void) | undefined | null;
    color?: string | undefined | null;
    borderColor?: string | undefined | null;
    textColor?: string | undefined | null;
    constructor();
}
type PromptItem = {
    type: 'password' | 'label' | 'textinput';
    /**
     * Text value of a label, or placeholder value of a text/password input, or raw html value without any parsing
     */
    value: string;
    default?: boolean;
} | HTMLElement;
type PromptReturnDatum = {
    type: 'password' | 'textinput';
    value: string;
};
/**
 * Includes an array of the values of all input fields.
 * 	e.g.: if contents[0] is a label, contents[1] is a textinput, contents[2] is a label, and contents[3] is a password,
 * 	then data will be [{type: 'textinput', value: string}, {type: 'password', value: string}]
 */
type PromptReturn = {
    cancelled: boolean;
    data: PromptReturnDatum[];
};
type PromptButton = {
    /**
     * Text to show in the button
     */
    label: string;
    /**
     * Whether to highlight this button
     */
    default: boolean;
    /**
     * Action to execute when the button is clicked
     */
    action: (this: Prompt) => void;
    timeout?: number;
};
type PromptOptions = {
    allowClickAway?: boolean;
};
declare class Prompt {
    animateDuration: number;
    card: JQuery;
    darkener: JQuery;
    contents: PromptItem[];
    elements: JQuery[];
    promise: Promise<PromptReturn> | undefined;
    buttons: PromptButton[];
    resolvePromise: ((...args: any[]) => void) | undefined;
    options: PromptOptions;
    constructor(contents: PromptItem[], buttons: PromptButton[], options?: PromptOptions);
    static show(contents: PromptItem[], buttons: PromptButton[], options?: PromptOptions): Promise<PromptReturn>;
    show(): Promise<PromptReturn>;
    onKeyDown(e: KeyboardEvent): void;
    getData(): PromptReturnDatum[];
    resolve(): void;
    cancel(): void;
    hide(): void;
    _enrichText(text: string): JQuery;
}
declare class PasswordPrompt {
    static show(text: string): Promise<{
        cancelled: boolean;
        password: string;
    }>;
}
declare class Confirm {
    static show(text: string, options?: ConfirmOptions): Promise<PromptReturn>;
}
declare class Alert {
    static show(text: string): Promise<PromptReturn>;
}
/**
 * Returns a set of PromptButtons for something like Yes/No, with the first one highlighted.
 */
declare function twoPromptButtons(text1: string, text2: string): PromptButton[];
interface ConfirmOptions {
    yesText?: string;
    noText?: string;
    yesTimeout?: number;
}
declare function debugToHTML(message: any, replace?: boolean): void;
/**
 * Run a particular piece of code when the window resizes, but after waiting a few ms to reduce processor demand.
 * @param cb Callback to run on a resize event.
 */
declare function onResize(cb: () => void): void;
/**
 * Assert a condition & display an error message to the user.
 * @param condition Condition to test
 * @param message Message to display
 */
declare function assert(condition: unknown, message?: any): asserts condition;
/**
 * Assert a condition & display an error message to the user WITHOUT a call stack.
 * @param {boolean} condition Condition to test
 * @param {string} message Message to display
 */
declare function lightAssert(condition: unknown, message?: any): asserts condition;
declare function scrollToId(id: string): void;
declare function share(orgKey: string | boolean): Promise<void>;
declare function selectLanguage(): void;
declare function copyClipboardDom(text: string): void;
/**
 * Measure the time interval to execute the callback function.
 * @param cb Function to run
 */
declare function measureTime(cb: () => void): number;
declare class Cookies {
    static get(key: string): string;
    static set(key: string, value: string, value2?: any): string;
    static remove(key: string): void;
}
