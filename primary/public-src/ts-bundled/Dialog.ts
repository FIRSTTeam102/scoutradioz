/**
 * Modal dialog element with a close button.
 */
class Dialog {
	static getDialog() {
		let dialogElement = $('dialog#dialogElement') as JQuery<HTMLDialogElement>;
		if (!(dialogElement[0] instanceof HTMLDialogElement)) {
			dialogElement = $(document.createElement('dialog'))
				.html(
					`<div id="dialogContent">
						<button id="closePreviewBtn">X</button>
						<iframe id="previewFrame"></iframe>
					</div>`
				)
				.prop('id', 'dialogElement')
				.appendTo(document.body);
			dialogElement.find('button#closePreviewBtn').on('click', () => {
				dialogElement[0].close();
			});
		}
		return dialogElement;
	}
	
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
	static show(html: string) {
		let dialog = this.getDialog();
		let iframe = dialog.find('iframe#previewFrame') as JQuery<HTMLIFrameElement>;
		iframe[0].srcdoc = html;
		dialog[0].showModal();
	}

	/**
	 * Open the modal dialog and populate it with the URL you specified. 
	 * The web request will set the InModalDialog to true automatically, disabling the page heaader.
	 * @param url URL to open
	 */
	static showURL(url: string) {
		fetch(url, {method: 'GET', headers: {'In-Modal-Dialog': 'true'}})
			.then(response => response.text())
			.then(html => Dialog.show(html))
			.catch(console.error);
	}
}
