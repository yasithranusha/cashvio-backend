import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { DiscountType } from '@prisma/client';
import { OrderService } from '../order.service';

@Injectable()
export class ReceiptPdfService {
  private readonly logger = new Logger(ReceiptPdfService.name);

  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  async generateReceiptPdf(order: any, shop: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        // Decrypt order values
        const decryptedOrder = await this.orderService.decryptOrderData(order);

        // Decrypt order items
        const decryptedItems = await Promise.all(
          order.orderItems.map(async (item) => {
            const decryptedItem =
              await this.orderService.decryptOrderItemData(item);
            return {
              ...item,
              ...decryptedItem,
            };
          }),
        );

        // Decrypt payments
        const decryptedPayments = await Promise.all(
          order.payments.map(async (payment) => {
            const decryptedPayment =
              await this.orderService.decryptPaymentData(payment);
            return {
              ...payment,
              ...decryptedPayment,
            };
          }),
        );

        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Header
        doc.fontSize(20).text('Order Receipt', { align: 'center' });
        doc.moveDown();

        // Shop Information
        doc.fontSize(12).text(shop.businessName, { align: 'center' });
        doc.moveDown();

        // Order Details
        doc.fontSize(12).text(`Order ID: ${order.id}`);
        doc.text(`Date: ${format(new Date(order.createdAt), 'PPpp')}`);
        doc.text(`Status: ${order.status}`);
        if (order.note) {
          doc.text(`Note: ${order.note}`);
        }
        doc.moveDown();

        // Items Table Header
        const tableTop = doc.y;
        doc.fontSize(10);
        doc.text('Item', 50, tableTop);
        doc.text('Original', 200, tableTop);
        doc.text('Selling', 250, tableTop);
        doc.text('Qty', 300, tableTop);
        doc.text('Total', 350, tableTop);
        doc.text('Saved', 400, tableTop);
        doc.moveDown();

        // Items
        let y = doc.y;
        for (const item of decryptedItems) {
          const originalPrice = parseFloat(item.originalPrice);
          const sellingPrice = parseFloat(item.sellingPrice);
          const quantity = item.quantity;
          const total = sellingPrice * quantity;
          const saved = (originalPrice - sellingPrice) * quantity;

          doc.text(item.product.name, 50, y);
          doc.text(originalPrice.toFixed(2), 200, y);
          doc.text(sellingPrice.toFixed(2), 250, y);
          doc.text(quantity.toString(), 300, y);
          doc.text(total.toFixed(2), 350, y);
          doc.text(saved.toFixed(2), 400, y);
          y += 20;

          // Check if we need a new page
          if (y > 700) {
            doc.addPage();
            y = 50;
          }
        }

        // Summary
        doc.moveDown(2);
        const summaryTop = doc.y;
        doc.text('Subtotal:', 300, summaryTop);
        doc.text(decryptedOrder.subtotal.toFixed(2), 400, summaryTop);

        if (decryptedOrder.discount > 0) {
          doc.text(
            `Discount (${decryptedOrder.discountType === DiscountType.PERCENTAGE ? decryptedOrder.discount + '%' : 'Fixed'}):`,
            300,
            doc.y + 20,
          );
          doc.text(`-${decryptedOrder.discount.toFixed(2)}`, 400, doc.y + 20);
        }

        // Calculate total saved
        const totalSaved = decryptedItems.reduce((sum, item) => {
          const originalPrice = parseFloat(item.originalPrice);
          const sellingPrice = parseFloat(item.sellingPrice);
          return sum + (originalPrice - sellingPrice) * item.quantity;
        }, 0);

        doc.text('Total Saved:', 300, doc.y + 20);
        doc.text(totalSaved.toFixed(2), 400, doc.y + 20);

        doc.text('Final Total:', 300, doc.y + 20);
        doc.text(decryptedOrder.total.toFixed(2), 400, doc.y + 20);

        // Payment Information
        doc.moveDown(2);
        doc.fontSize(12).text('Payment Information');
        doc.fontSize(10);
        for (const payment of decryptedPayments) {
          doc.text(`${payment.method}: ${payment.amount.toFixed(2)}`);
        }

        // Wallet Information
        if (order.customer) {
          doc.moveDown(2);
          doc.fontSize(12).text('Wallet Information');
          doc.fontSize(10);

          if (decryptedOrder.walletBalance) {
            doc.text(
              `Current Balance: ${decryptedOrder.walletBalance.toFixed(2)}`,
            );
          }

          if (decryptedOrder.paymentDue > 0) {
            doc.text(`Due Amount: ${decryptedOrder.paymentDue.toFixed(2)}`);
          }

          if (decryptedOrder.extraBalance > 0) {
            doc.text(
              `Extra Balance Added: ${decryptedOrder.extraBalance.toFixed(2)}`,
            );
          }

          if (decryptedOrder.pointsEarned) {
            doc.text(`Points Earned: ${decryptedOrder.pointsEarned}`);
            doc.text(
              `Total Points Balance: ${decryptedOrder.totalPointsBalance}`,
            );
          }
        }

        // Footer
        doc.moveDown(4);
        doc
          .fontSize(10)
          .text('Thank you for your business!', { align: 'center' });
        doc.text('The CASHVIO Team', { align: 'center' });
        doc.text('support@cashvio.net', { align: 'center' });

        doc.end();
      } catch (error) {
        this.logger.error('Error generating PDF:', error);
        reject(error);
      }
    });
  }
}
