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
$(function () {
    Cookies.remove('preprocessImages');
    if (Cookies.get('preprocessImages') == '1') {
        $('input[name=chkPreprocess]').prop('checked', true);
    }
    $('input[name=chkPreprocess]').on('change', function () {
        if (this.checked == true) {
            Cookies.set('preprocessImages', '1');
        }
        else {
            Cookies.set('preprocessImages', '0');
        }
    });
    $('input[type=file]').on('change', submitImage);
    $('#submit').on('click', function () {
        var pitForm = $('form[name=scoutform]');
        console.log(pitForm);
        var pitSubmission = new FormSubmission(pitForm, '/scouting/pit/submit', 'pitScouting');
        console.log(pitSubmission);
        pitSubmission.submit((err, message) => {
            if (err || !message) {
                NotificationCard.error('An error occurred. Please retry.');
            }
            else {
                NotificationCard.show(message, { darken: true, type: 'good', ttl: 0 });
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            }
        });
    });
    window.onbeforeunload = function () {
        return 'Leaving this page will lose pit scouting data.';
    };
});
function submitImage() {
    return __awaiter(this, void 0, void 0, function* () {
        var imageInput = this;
        var imageInputID = imageInput.id;
        var button = $(`label[for=${imageInputID}]`);
        var index = $(imageInput).attr('index');
        var year = $('input[name=year]').val();
        var orgKey = $('input[name=org_key]').val();
        var teamKey = $('input[name=team_key]').val();
        var userId = $('input[name=user]').val();
        var uploadURLBase = $('input[name=uploadURL]').val();
        var uploadURL = `${uploadURLBase}?index=${index}&year=${year}&org_key=${orgKey}&team_key=${teamKey}&user=${userId}`;
        var data = new FormData();
        if (!imageInput.files)
            return console.error('imageInput.files is not defined');
        var imageData = yield getImageData(imageInput.files[0]);
        if (imageData) {
            var imageFile = imageData;
            data.append('image', imageFile);
            console.log('Got data, going to submit to ' + uploadURL);
            console.log(data.get('image'));
            $(button).addClass('w3-disabled');
            var uploadingCard = new NotificationCard('Uploading photo...', { ttl: 0 }).show();
            try {
                $.ajax({
                    type: 'POST',
                    enctype: 'multipart/form-data',
                    url: uploadURL,
                    data: data,
                    processData: false,
                    contentType: false,
                    cache: false,
                    timeout: 60000,
                    success: function (data) {
                        console.log('SUCCESS : ', data);
                        $(button).removeClass('w3-disabled');
                        uploadingCard.remove(0);
                        NotificationCard.good('Photo successfully uploaded.');
                        if (typeof data == 'object') {
                            switch (imageInputID) {
                                case 'imageMain':
                                    $('#imgMain').attr('src', `${data[1]}?${Date.now()}`);
                                    break;
                                case 'imageA':
                                    $('#imgA').attr('src', `${data[2]}?${Date.now()}`);
                                    break;
                                case 'imageB':
                                    $('#imgB').attr('src', `${data[2]}?${Date.now()}`);
                                    break;
                                case 'imageC':
                                    $('#imgC').attr('src', `${data[2]}?${Date.now()}`);
                                    break;
                            }
                        }
                    },
                    error: function (err, textStatus, errorThrown) {
                        console.error(err.responseText || err);
                        $(button).removeClass('w3-disabled');
                        uploadingCard.remove(0);
                        var message = err.responseText || errorThrown.message || 'An error occurred.';
                        NotificationCard.show(message, { type: 'bad', ttl: 10000 });
                    },
                });
            }
            catch (l) {
                uploadingCard.remove(0);
                NotificationCard.show(JSON.stringify(l), { type: 'bad', ttl: 10000 });
            }
        }
    });
}
function getImageData(file) {
    return new Promise((resolve, reject) => {
        var imageData;
        var preprocessImages = $('input[name=chkPreprocess]').prop('checked');
        if (preprocessImages) {
            console.log('Going to pre-process image.');
            if (window.hasOwnProperty('Jimp')) {
                var preReadTime = Date.now();
                var reader = new FileReader();
                reader.onload = () => __awaiter(this, void 0, void 0, function* () {
                    var imgArrayBuffer = reader.result;
                    NotificationCard.show('Compressing photo...');
                    var preJimpReadTime = Date.now();
                    var image = yield Jimp.read(imgArrayBuffer);
                    var jimpReadTime = Date.now();
                    var width = image.bitmap.width, height = image.bitmap.height;
                    var ratio = width / height;
                    var resizeWidth, resizeHeight;
                    if (width > 1000 && height > 1000) {
                        if (width < height) {
                            resizeWidth = 1000;
                            resizeHeight = Math.floor(resizeWidth / ratio);
                        }
                        else {
                            resizeHeight = 1000;
                            resizeWidth = Math.floor(resizeHeight * ratio);
                        }
                        console.log('Resizing image');
                        image.resize(resizeWidth, resizeHeight)
                            .quality(60);
                    }
                    else {
                        image.quality(90);
                    }
                    var imgResizeTime = Date.now();
                    image.getBuffer('image/jpeg', (err, newArrayBuffer) => __awaiter(this, void 0, void 0, function* () {
                        if (err) {
                            console.error(err);
                            debugToHTML(err);
                            resolve(file);
                        }
                        var imgBufferTime = Date.now();
                        var str = `FileRead: ${preJimpReadTime - preReadTime}ms, JimpRead: ${jimpReadTime - preJimpReadTime}ms, Resize: ${imgResizeTime - jimpReadTime}ms, getBuffer: ${imgBufferTime - imgResizeTime}ms`;
                        console.log(str);
                        debugToHTML(str);
                        var newFile = new File(newArrayBuffer, file.name, { type: 'image/jpeg' });
                        console.log(newArrayBuffer);
                        console.log(newFile);
                        resolve(newFile);
                    }));
                });
                reader.readAsArrayBuffer(file);
            }
            else {
                resolve(file);
            }
        }
        else {
            resolve(file);
        }
    });
}
