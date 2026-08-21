<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Cotización {{ $order->order_number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #1f2937; font-size: 12px; margin: 0; }
        .masthead { background: #111827; color: #fff; padding: 20px 28px; }
        .masthead .brand { font-size: 22px; font-weight: 800; letter-spacing: .5px; }
        .masthead .sub { color: #9ca3af; font-size: 11px; margin-top: 2px; }
        .body { padding: 24px 28px; }
        .company-line { font-size: 11px; color: #4b5563; margin-top: 6px; line-height: 1.5; }
        .invoice-title { font-size: 26px; font-weight: 800; color: #111827; margin: 0; }
        .invoice-meta { color: #6b7280; font-size: 11px; margin-top: 2px; }
        .badge { display: inline-block; background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
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
        .diagnosis { margin-top: 18px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
        .diagnosis h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .8px; color: #6b7280; }
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
                <div class="invoice-title">Cotización</div>
                <div class="invoice-meta">{{ $order->order_number }} · {{ $order->service_type }}</div>
            </div>
            <div style="text-align:right;">
                @if (!empty($workshop['logo']))
                <img src="{{ $workshop['logo'] }}" alt="Logo" style="max-height:56px; margin-bottom:6px;">
                @endif
                <div><span class="badge">Pendiente de aprobación</span></div>
            </div>
        </div>

        <table style="width:100%; margin-top:18px;">
            <tr>
                <td style="width:50%; vertical-align:top;">
                    <div class="panel">
                        <h4>Cliente</h4>
                        <div style="font-weight:700;">{{ $order->user?->name ?? 'Cliente' }}</div>
                        <div style="font-size:11px; color:#6b7280; margin-top:3px;">{{ $order->user?->email ?? '' }}</div>
                    </div>
                </td>
                <td style="vertical-align:top;">
                    <div class="panel" style="text-align:right;">
                        <h4>Detalles</h4>
                        <div><strong>Fecha:</strong> {{ now()->format('d/m/Y') }}</div>
                        @if ($order->motorcycle)
                        <div style="margin-top:3px;"><strong>Moto:</strong> {{ $order->motorcycle->nickname ?: $order->motorcycle->plate }}</div>
                        @if ($order->motorcycle->brand) <div style="margin-top:3px;"><strong>Marca:</strong> {{ $order->motorcycle->brand->name }}</div> @endif
                        @if ($order->motorcycle->plate) <div style="margin-top:3px;"><strong>Placa:</strong> {{ $order->motorcycle->plate }}</div> @endif
                        @endif
                        @if ($order->mechanic)
                        <div style="margin-top:3px;"><strong>Técnico:</strong> {{ $order->mechanic->name }}</div>
                        @endif
                    </div>
                </td>
            </tr>
        </table>

        @if ($order->diagnosis)
        <div class="diagnosis">
            <h4>Diagnóstico</h4>
            <div style="font-size:12px; color:#4b5563;">{{ $order->diagnosis }}</div>
        </div>
        @endif

        @if ($order->items->isNotEmpty())
        <h4 style="margin:18px 0 0; font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:#6b7280;">Repuestos</h4>
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
                @foreach ($order->items as $item)
                <tr>
                    <td>{{ $item->description }}</td>
                    <td class="num">{{ $item->quantity }}</td>
                    <td class="num">${{ number_format($item->unit_price, 2) }}</td>
                    <td class="num">${{ number_format($item->quantity * $item->unit_price, 2) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @endif

        @if ($order->labors->isNotEmpty())
        <h4 style="margin:18px 0 0; font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:#6b7280;">Mano de obra</h4>
        <table class="items">
            <thead>
                <tr>
                    <th>Descripción</th>
                    <th class="num" style="width:70px;">Horas</th>
                    <th class="num" style="width:130px;">Valor</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($order->labors as $labor)
                <tr>
                    <td>{{ $labor->description }}</td>
                    <td class="num">{{ $labor->hours }}</td>
                    <td class="num">${{ number_format($labor->amount, 2) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @endif

        <div class="totals">
            <p><span>Subtotal</span><strong>${{ number_format($order->quotation_subtotal, 2) }}</strong></p>
            <p><span>Impuestos</span><strong>${{ number_format(0, 2) }}</strong></p>
            <p class="total-row"><span>Total a pagar</span><span>${{ number_format($order->quotation_total ?? $order->quotation_subtotal, 2) }}</span></p>
        </div>

        <div class="thanks">Esta cotización está pendiente de tu aprobación. Puedes aprobarla, pedir cambios o rechazarla desde tu portal «Mis servicios».</div>

        <div class="footer">
            {{ $workshop['name'] ?? 'MotoSystem' }} · {{ $order->order_number }} · Generado el {{ now()->format('d/m/Y H:i') }}
        </div>
    </div>
</body>
</html>
