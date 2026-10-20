/**
 * Google Apps Script - YSBK Recruitment Form Webhook Trigger
 * Tự động gửi dữ liệu đơn ứng tuyển sang hệ thống YSBK ngay khi có phản hồi mới.
 * Sử dụng chữ ký số HMAC-SHA256 và cơ chế Retry với Exponential Backoff.
 * 
 * Cài đặt:
 * 1. Mở Google Form hoặc Google Sheets liên kết với Form.
 * 2. Chọn Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Dán mã nguồn này vào tệp Code.gs.
 * 4. Cấu hình các hằng số: YSBK_WEBHOOK_URL và YSBK_WEBHOOK_SECRET.
 * 5. Thiết lập Trigger: Chọn biểu tượng đồng hồ (Triggers) -> Add Trigger:
 *    - Function: onFormSubmit
 *    - Event source: From form (hoặc From spreadsheet)
 *    - Event type: On form submit
 */

var YSBK_WEBHOOK_URL = 'https://clbsach.example.vn/api/v1/recruitment/webhook/google-form';
// BẢO MẬT (P22-01): Tuyệt đối không commit secret thật vào mã nguồn.
// Thay giá trị dưới đây bằng chuỗi bí mật đã cấu hình trong biến môi trường RECRUITMENT_WEBHOOK_SECRET của máy chủ.
var YSBK_WEBHOOK_SECRET = '<YOUR_CONFIGURED_RECRUITMENT_WEBHOOK_SECRET>';
var FORM_ID = 'FORM_GEN_10_2026';

function onFormSubmit(e) {
  if (!e) {
    Logger.log('Không có event object (e). Vui lòng chạy qua Form Submit Trigger.');
    return;
  }

  var responseId = '';
  var submissionTimestamp = new Date().toISOString();
  var answers = {};

  if (e.response) {
    // Kích hoạt từ Google Form trực tiếp
    var formResponse = e.response;
    responseId = formResponse.getId();
    submissionTimestamp = formResponse.getTimestamp().toISOString();
    var itemResponses = formResponse.getItemResponses();

    for (var i = 0; i < itemResponses.length; i++) {
      var item = itemResponses[i];
      var title = item.getItem().getTitle();
      var resp = item.getResponse();
      answers[title] = resp;
    }
  } else if (e.namedValues) {
    // Kích hoạt từ Google Sheets liên kết
    responseId = 'SHEET_ROW_' + (e.range ? e.range.getRow() : new Date().getTime());
    var keys = Object.keys(e.namedValues);
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      answers[k] = e.namedValues[k][0];
    }
  }

  var payload = {
    formId: FORM_ID,
    responseId: responseId,
    timestamp: submissionTimestamp,
    answers: answers
  };

  sendWebhookWithRetry(payload, 3);
}

function sendWebhookWithRetry(payload, maxRetries) {
  var payloadStr = JSON.stringify(payload);
  var timestamp = Date.now().toString();

  // Tính toán chữ ký HMAC-SHA256
  var signatureBytes = Utilities.computeHmacSha256Signature(timestamp + '.' + payloadStr, YSBK_WEBHOOK_SECRET);
  var signatureHex = signatureBytes.reduce(function(str, byte) {
    var hex = (byte < 0 ? byte + 256 : byte).toString(16);
    return str + (hex.length === 1 ? '0' : '') + hex;
  }, '');

  var headers = {
    'Content-Type': 'application/json',
    'X-Timestamp': timestamp,
    'X-YSBK-Signature': signatureHex,
    'X-Webhook-Secret': YSBK_WEBHOOK_SECRET
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: payloadStr,
    muteHttpExceptions: true
  };

  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      var response = UrlFetchApp.fetch(YSBK_WEBHOOK_URL, options);
      var statusCode = response.getResponseCode();
      if (statusCode >= 200 && statusCode < 300) {
        Logger.log('Đã gửi thành công webhook đơn ' + payload.responseId + ' (HTTP ' + statusCode + ')');
        return;
      } else {
        Logger.log('Lỗi gửi webhook lần ' + attempt + ': HTTP ' + statusCode + ' - ' + response.getContentText());
      }
    } catch (err) {
      Logger.log('Ngoại lệ khi gọi webhook lần ' + attempt + ': ' + err.toString());
    }

    if (attempt < maxRetries) {
      var delayMs = Math.pow(2, attempt) * 1000;
      Utilities.sleep(delayMs);
    }
  }

  Logger.log('CẢNH BÁO: Đã thử gửi webhook ' + maxRetries + ' lần thất bại. Đơn sẽ được nạp bù qua Reconcile Checkpoint.');
}
