<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Certificado de Garantía</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #1f2937; font-size: 12px; }
        .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
        .brand { font-size: 20px; font-weight: bold; color: #2563eb; }
        .seal { border: 3px solid #2563eb; border-radius: 50%; width: 110px; height: 110px; margin: 16px auto; text-align: center; line-height: 110px; color: #2563eb; font-weight: bold; }
        table.details { width: 100%; border-collapse: collapse; margin-top: 16px; }
        table.details td { border: 1px solid #e5e7eb; padding: 10px; }
        table.details td.label { background: #f3f4f6; width: 45%; font-weight: bold; }
        .warranty { margin-top: 24px; border: 1px solid #2563eb; border-radius: 8px; padding: 16px; }
        .warranty h2 { margin-top: 0; color: #0256eb; }
        .footer { margin-top: 32px; font-size: 10px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="header">
        <div class="brand">{{ $workshop['name'] }}</div>
        <div>Taller de Motocicletas<br>{{ $workshop['address'] }}</div>
    </div>

    <h2 style="color:#2563eb; text-align:center;">Certificado de Garantía</h2>

    <div class="seal">Garantizado</div>

    <div class="warranty">
        <h2 style="color:#2563eb;">{{ $warranty->description }}</h2>
        <table class="details">
            <tr>
                <td class="label">Cliente</td>
                <td>{{ $order->user?->name ?? 'Cliente' }}</td>
            </tr>
            <tr>
                <td class="label">Orden de trabajo</td>
                <td>{{ $order->order_number }}</td>
            </tr>
            <tr>
                <td class="label">Motocicleta</td>
                <td>
                    @if($order->motorcycle)
                        {{ $order->motorcycle->nickname ?: $order->motorcycle->plate }}
                        @if($order->motorcycle->brand) ({{ $order->motorcycle->brand->name }})@endif
                    @else
                        —
                    @endif
                </td>
            </tr>
            @if ($warranty->product)
            <tr>
                <td class="label">Producto</td>
                <td>{{ $warranty->product->name }}</td>
            </tr>
            @endif
            <tr>
                <td class="label">Tipo de garantía</td>
                <td>{{ $warranty->type === 'km' ? 'Por kilometraje' : 'Por tiempo' }}</td>
            </tr>
            <tr>
                <td class="label">Duración</td>
                <td>
                    @if($warranty->type === 'km')
                        {{ number_format($warranty->duration) }} km
                    @else
                        {{ $warranty->duration }} {{ $warranty->duration == 1 ? 'mes' : 'meses' }}
                    @endif
                </td>
            </tr>
            <tr>
                <td class="label">Fecha de inicio</td>
                <td>{{ $warranty->start_date?->format('d/m/Y') }}</td>
            </tr>
            <tr>
                <td class="label">Fecha de vencimiento</td>
                <td>{{ $warranty->end_date?->format('d/m/Y') ?? '—' }}</td>
            </tr>
        </table>
    </div>

    <div class="footer">
        Este certificado acredita la cobertura de la garantía descrita. Aplica según las condiciones y términos del taller MotoSystem.<br>
        Emitido el {{ now()->format('d/m/Y') }} · Garantía #{{ $warranty->id }} · Orden {{ $order->order_number }}
    </div>
</body>
</html>