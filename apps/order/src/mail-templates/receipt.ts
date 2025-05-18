export const orderReceiptMail = `
<table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper">
        <tbody>
          <tr>
            <td valign="top" class="esd-email-paddings">
              <table cellpadding="0" cellspacing="0" align="center" class="es-content esd-header-popover">
                <tbody></tbody>
              </table>
              <table cellpadding="0" cellspacing="0" align="center" class="es-header">
                <tbody></tbody>
              </table>
              <table cellpadding="0" cellspacing="0" align="center" class="es-content">
                <tbody>
                  <tr>
                    <td align="center" class="esd-stripe">
                      <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0" width="600" class="es-content-body">
                        <tbody>
                          <tr>
                            <td align="left" class="esd-structure es-p15t es-p20r es-p20l">
                              <table cellpadding="0" cellspacing="0" width="100%">
                                <tbody>
                                  <tr>
                                    <td width="560" align="center" valign="top" class="esd-container-frame">
                                      <table cellpadding="0" cellspacing="0" width="100%">
                                        <tbody>
                                          <tr>
                                            <td align="center" class="esd-block-image es-p10t es-p10b" style="font-size:0px">
                                              <a target="_blank">
                                                <img src="https://fkhotku.stripocdn.email/content/guids/CABINET_4db9c4d190ed57e3a9d22ce7206baffad4a452fe67de83d4d4cb39e95a5bf9de/images/cashviologo.png" alt="" width="145" class="adapt-img" style="display:block">
                                              </a>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="center" esd-links-underline="none" class="esd-block-text es-p15t es-p15b">
                                              <h1 class="es-m-txt-c">
                                                Order Receipt
                                              </h1>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="left" class="esd-block-text es-p10t es-p10b">
                                              <p style="font-size:16px">
                                                Hello, %customerName%! Thank you for your purchase. Here is your receipt for order #%orderId%.
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td align="left" class="esd-structure es-p10b es-p20r es-p20l">
                              <table cellpadding="0" cellspacing="0" width="100%">
                                <tbody>
                                  <tr>
                                    <td width="560" align="center" valign="top" class="esd-container-frame">
                                      <table cellpadding="0" cellspacing="0" width="100%" style="border-radius:5px;border-collapse:separate">
                                        <tbody>
                                          <tr>
                                            <td align="left" class="esd-block-text es-p10b">
                                              <h3>Order Details</h3>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="left" class="esd-block-text">
                                              <p><strong>Order ID:</strong> %orderId%</p>
                                              <p><strong>Date:</strong> %orderDate%</p>
                                              <p><strong>Shop:</strong> %shopName%</p>
                                              %noteSection%
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="left" class="esd-block-text es-p10t es-p10b">
                                              <h3>Items</h3>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="left" class="esd-block-text">
                                              <table style="width: 100%; border-collapse: collapse;">
                                                <thead>
                                                  <tr style="border-bottom: 1px solid #ddd;">
                                                    <th style="padding: 8px; text-align: left;">Item</th>
                                                    <th style="padding: 8px; text-align: right;">Original Price</th>
                                                    <th style="padding: 8px; text-align: right;">Selling Price</th>
                                                    <th style="padding: 8px; text-align: right;">Qty</th>
                                                    <th style="padding: 8px; text-align: right;">Total</th>
                                                    <th style="padding: 8px; text-align: right;">Saved</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  %itemsTable%
                                                </tbody>
                                              </table>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="left" class="esd-block-text es-p10t">
                                              <table style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                  <td style="padding: 8px; text-align: right;"><strong>Subtotal:</strong></td>
                                                  <td style="padding: 8px; text-align: right;">%subtotal%</td>
                                                </tr>
                                                %discountRow%
                                                <tr>
                                                  <td style="padding: 8px; text-align: right;"><strong>Total Saved:</strong></td>
                                                  <td style="padding: 8px; text-align: right;">%totalSaved%</td>
                                                </tr>
                                                <tr style="border-top: 1px solid #ddd;">
                                                  <td style="padding: 8px; text-align: right;"><strong>Final Total:</strong></td>
                                                  <td style="padding: 8px; text-align: right;"><strong>%total%</strong></td>
                                                </tr>
                                              </table>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="left" class="esd-block-text es-p10t es-p10b">
                                              <h3>Payment Information</h3>
                                              <table style="width: 100%; border-collapse: collapse;">
                                                <tbody>
                                                  %paymentMethods%
                                                </tbody>
                                              </table>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="left" class="esd-block-text es-p10t es-p10b">
                                              <h3>Wallet Information</h3>
                                              <table style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                  <td style="padding: 8px; text-align: left;"><strong>Current Balance:</strong></td>
                                                  <td style="padding: 8px; text-align: right;">%walletBalance%</td>
                                                </tr>
                                                %dueAmountRow%
                                                %extraBalanceRow%
                                                <tr>
                                                  <td style="padding: 8px; text-align: left;"><strong>Points Earned:</strong></td>
                                                  <td style="padding: 8px; text-align: right;">%pointsEarned%</td>
                                                </tr>
                                                <tr>
                                                  <td style="padding: 8px; text-align: left;"><strong>Total Points Balance:</strong></td>
                                                  <td style="padding: 8px; text-align: right;">%totalPointsBalance%</td>
                                                </tr>
                                              </table>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="left" class="esd-block-text es-p20t es-p10b">
                                              <p>
                                                Got a question? Email us at&nbsp;<a target="_blank" href="mailto:">support@cashvio.net</a>
                                              </p>
                                              <p>
                                                <br>Thank you for your business,
                                              </p>
                                              <p>
                                                The CASHVIO Team!
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
              <table cellpadding="0" cellspacing="0" align="center" class="es-footer">
                <tbody></tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>`;
