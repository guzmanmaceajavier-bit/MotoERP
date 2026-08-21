<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Factura {{ $invoice->invoice_number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #1f2937; font-size: 12px; margin: 0; }
        .masthead { background: #111827; color: #fff; padding: 20px 28px; }
        .masthead .brand { font-size: 22px; font-weight: 800; letter-spacing: .5px; }
        .masthead .sub { color: #9ca3af; font-size: 11px; margin-top: 2px; }
        .body { padding: 24px 28px; }
        .company-line { font-size: 11px; color: #4b5563; margin-top: 6px; line-height: 1.5; }
        .invoice-title { font-size: 26px; font-weight: 800; color: #111827; margin: 0; }
        .invoice-meta { color: #6b7280; font-size: 11px; margin-top: 2px; }
        .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
        .panel { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
        .panel h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .8px; color: #6b7280; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 18px; }
        table.items th { background: #f3f4f6; color: #374151; font-size: 10px; text-transform: uppercase; letter-spacing: .6px; }
        table.items th, table.items td { border: 1px solid #e5e7eb; padding: 9px; text-align: left; }
        table.items td { font-size: 12px; }
        .num { text-align: right; }
        .totals { margin-top: 18px; margin-left: auto; width: 60%; }
        .totals p { display: flex; justify-content: space-between; margin: 5px 0; }
        .totals .total-row { border-top: 2px solid #111827; font-size: 17px; font-weight: 800; padding-top: 8px; margin-top: 8px; }
        .footer { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 10px; color: #9ca3af; }
        .thanks { margin-top: 16px; font-size: 12px; color: #4b5563; }
    </style>
</head>
<body>
    <div class="masthead">
        <div class="brand">{{ $workshop['name'] ?? 'MotoSystem' }}</div>
        <div class="sub">Taller de Motocicletas</div>
        <div class="company-line">
            @if (!empty($workshop['address'])){{ $workshop['address'] }} · @endif
            @if (!empty($workshop['phone']))Tel: {{ $workshop['phone'] }} · @endif
            @if (!empty($workshop['email'])){{ $workshop['email'] }}@endif
        </div>
    </div>

    <div class="body">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
                <div class="invoice-title">Factura</div>
                <div class="invoice-meta">{{ $invoice->invoice_number }}</div>
            </div>
            <div style="text-align:right;">
                @if (!empty($workshop['logo']))
                <img src="{{ $workshop['logo'] }}" alt="Logo" style="max-height:56px; margin-bottom:6px;">
                @endif
                <div><span class="badge">{{ $invoice->status }}</span></div>
            </div>
        </div>

        <table style="width:100%; margin-top:18px;">
            <tr>
                <td style="width:50%; vertical-align:top;">
                    <div class="panel">
                        <h4>Facturar a</h4>
                        <div style="font-weight:700;">{{ $invoice->customer_name ?: ($invoice->user?->name ?? 'Cliente') }}</div>
                        <div style="font-size:11px; color:#6b7280; margin-top:3px;">
                            {{ $invoice->customer_email ?: ($invoice->user?->email ?? '') }}
                        </div>
                    </div>
                </td>
                <td style="vertical-align:top;">
                    <div class="panel" style="text-align:right;">
                        <h4>Detalles</h4>
                        <div><strong>Fecha:</strong> {{ $invoice->issue_date?->format('d/m/Y') }}</div>
                        <div style="margin-top:3px;"><strong>Método:</strong> {{ ucfirst($invoice->payment_method) }}</div>
                        @if ($invoice->workOrder?->order_number)
                        <div style="margin-top:3px;"><strong>Orden:</strong> {{ $invoice->workOrder->order_number }}</div>
                        @endif
                    </div>
                </td>
            </tr>
        </table>

        <table class="items">
            <thead>
                <tr>
                    <th>Descripción</th>
                    <th class="num" style="width:70px;">Cant.</th>
                    <th class="num" style="width:110px;">P. Unitario</th>
                    <th class="num" style="width:110px;">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($invoice->items as $item)
                <tr>
                    <td>{{ $item->description }}</td>
                    <td class="num">{{ $item->quantity }}</td>
                    <td class="num">${{ number_format($item->unit_price, 2) }}</td>
                    <td class="num">${{ number_format($item->total, 2) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>

        <div class="totals">
            <p><span>Subtotal</span><strong>${{ number_format($invoice->subtotal, 2) }}</strong></p>
            <p><span>Impuestos</span><strong>${{ number_format($invoice->tax, 2) }}</strong></p>
            @if ((float)$invoice->discount > 0)
            <p><span>Descuento por puntos ({{ $invoice->points_used }} pts)</span><strong>-${{ number_format($invoice->discount, 2) }}</strong></p>
            @endif
            <p><span>Pagado</span><strong>${{ number_format($invoice->paid_amount, 2) }}</strong></p>
            @if ((float)$invoice->outstanding > 0)
            <p><span>Pendiente</span><strong>${{ number_format($invoice->outstanding, 2) }}</strong></p>
            @endif
            <p class="total-row"><span>Total</span><span>${{ number_format($invoice->total, 2) }}</span></p>
        </div>

        @if (($invoice->workOrder?->warranties ?? collect())->isNotEmpty())
        <div style="margin-top:24px;">
            <h4 style="margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:#6b7280;">Garantías aplicables</h4>
            <table class="items">
                <thead>
                    <tr>
                        <th>Garantía</th>
                        <th style="width:120px;">Vigencia</th>
                        <th class="num" style="width:90px;">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($invoice->workOrder->warranties as $w)
                    <tr>
                        <td>{{ $w->description }}</td>
                        <td>
                            @if($w->type === 'km')
                                {{ number_format($w->duration) }} km
                            @else
                                Hasta {{ $w->end_date?->format('d/m/Y') }}
                            @endif
                        </td>
                        <td class="num">{{ $w->status }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
        @endif

        <div class="thanks">Gracias por confiar en {{ $workshop['name'] ?? 'nuestro taller' }}. Las garantías detalladas rigen según las condiciones del taller.</div>

        <div class="footer">
            {{ $workshop['name'] ?? 'MotoSystem' }} · {{ $invoice->invoice_number }} · Generado el {{ now()->format('d/m/Y H:i') }}
        </div>
    </div>
</body>
</html>