$(function(){
	
	//when a file input changes, run submit-image func.
	$('#uploadMain').on('click', submitOrgImage);
	$('input[type=file]').on('change', onImageChange);
	
});

async function onImageChange(this: HTMLInputElement){

	if (!this.files) return console.error('imageInput.files is not defined');
	// let imageData = await getOrgImageData(this.files[0]);
	// console.log(this.files);
	$('#fileName').text(this.files[0].name);
	$('#imgMain').attr('src', URL.createObjectURL(this.files[0]));

}

async function submitOrgImage(this: HTMLInputElement){

	let fileInputElem = document.getElementById('imageMain') as HTMLInputElement;
	if (!fileInputElem) return console.error('imageMain element is not defined');

	//var form = $("#imageform")[0];
	let imageInputID = fileInputElem.id;
	//get the label so we can disable it during upload
	let button = $(`label[for=${imageInputID}]`);
	
	//formulate the url that we send a request to
	let index = $(fileInputElem).attr('index');
	let year = $('input[name=year]').val();
	let orgKey = $('input[name=org_key]').val();
	// 2025-02-04, M.O'C: Adding alternate 'image id' option
	let imageId = $('input[name=image_id]').val();
	let userId = $('input[name=user]').val();
	let uploadURLBase = $('input[name=uploadURL]').val();
	
	let uploadURL = `${uploadURLBase}?index=${index}&year=${year}&org_key=${orgKey}&image_id=${imageId}&user=${userId}`;
	
	//create FormData object to submit
	let data = new FormData();
	
	if (!fileInputElem.files) return NotificationCard.error('Select an image to be uploaded');
	if (!imageId) return NotificationCard.error('Enter a unique ID to reference the image by');
	
	let imageData = await getOrgImageData(fileInputElem.files[0]);
	
	if (imageData) {
		
		let imageFile = imageData;
		
		// debugToHTML(imageData);
		// debugToHTML('imageData=' + typeof imageData);
		
		//**Append the file to the FormData object under name "image"
		data.append('image', imageFile);
		
		console.log('Got data, going to submit to ' + uploadURL);
		console.log(data.get('image'));
		
		//$("#logger").append(uploadURL + "\n");
		
		$(button).addClass('w3-disabled');
		
		let uploadingCard = new NotificationCard('Uploading photo...', {ttl: 0}).show();
		
		try{
			
			//Send an AJAX request
			$.ajax({
				type: 'POST',
				enctype: 'multipart/form-data',
				url: uploadURL,
				data: data,
				processData: false, //Tutorial said that it's important to set processData to false
				contentType: false,
				cache: false,
				timeout: 60000,
				success: function (data) {
					
					console.log('SUCCESS : ', data);
					$(button).removeClass('w3-disabled');
					
					uploadingCard.remove(0);
					NotificationCard.good('Photo successfully uploaded.');
					
					location.reload();
				},
				error: function (err, textStatus, errorThrown) {
					
					console.error(err.responseText || err);
					$(button).removeClass('w3-disabled');
					
					uploadingCard.remove(0);
					// @ts-ignore
					let message = err.responseText || errorThrown.message || 'An error occurred.';
					NotificationCard.show(message, {type: 'bad', ttl: 10000});
					
				},
			});	
		}
		catch (l) {
			uploadingCard.remove(0);
			NotificationCard.show(JSON.stringify(l), {type: 'bad', ttl: 10000});
			//debugToHTML("CAUGHT: "+l+"\n");
		}
	}
}

function getOrgImageData(file: File): Promise<File> {
	
	return new Promise((resolve, reject) => {
		let imageData;
	
		let preprocessImages = $('input[name=chkPreprocess]').prop('checked');
		
		// This section is for pre-processing images with Jimp, which has been unused for quite a while
		if (preprocessImages) {
			console.log('Going to pre-process image.');
			
			if (window.hasOwnProperty('Jimp')) {
				
				let preReadTime = Date.now();
				
				//Read file
				let reader = new FileReader();
				
				reader.onload = async () => {
					
					let imgArrayBuffer = reader.result;
						
					NotificationCard.show('Compressing photo...');
					
					let preJimpReadTime = Date.now();
					
					//Read image buffer
					let image = await OrgJimp.read(imgArrayBuffer);
					
					let jimpReadTime = Date.now();
					
					let width = image.bitmap.width, height = image.bitmap.height;
					let ratio = width / height;
					let resizeWidth, resizeHeight;
					
					//only resize if original image is larger than 1000x1000
					if (width > 1000 && height > 1000) {
						if (width < height) {
							resizeWidth = 1000;
							resizeHeight = Math.floor( resizeWidth / ratio );
						}
						else {
							resizeHeight = 1000;
							resizeWidth = Math.floor( resizeHeight * ratio );
						}
						
						console.log('Resizing image');
						
						//resize image and transform to jpg
						//A higher resolution image can be a lower quality
						image.resize( resizeWidth, resizeHeight )
							.quality(60);
						
					}
					else {
						//a lower resolution image should be a higher quality
						image.quality(90);
					}
					
					let imgResizeTime = Date.now();
					
					image.getBuffer('image/jpeg', async (err: Error, newArrayBuffer: BlobPart[]) => {
						if(err){
							console.error(err);
							debugToHTML(err);
							resolve(file);
						}
						
						let imgBufferTime = Date.now();
						
						let str = `FileRead: ${preJimpReadTime - preReadTime}ms, JimpRead: ${jimpReadTime - preJimpReadTime}ms, Resize: ${imgResizeTime-jimpReadTime}ms, getBuffer: ${imgBufferTime-imgResizeTime}ms`;
						console.log(str);
						debugToHTML(str);
						
						let newFile = new File(newArrayBuffer, file.name, {type: 'image/jpeg'});
						
						console.log(newArrayBuffer);
						console.log(newFile);
						
						resolve(newFile);
					});
				};
				
				reader.readAsArrayBuffer(file);
			}
			//Fallback if Jimp is not defined
			else {
				resolve(file);
			}
		}
		else {
			resolve(file);
		}
	});
}

declare class OrgJimp {
	static read(file: any): any;
}

// This is because JQuery types are dumb
interface HTMLElement {
	checked: boolean;
}