import type { Email } from './mailer';

interface Recipient {
  name: string;
  email: string;
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Plain, accessible layout that renders well in most mail clients. */
function layout(title: string, intro: string, action: string, url: string, outro: string) {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#eceef1;font-family:Arial,sans-serif;color:#16181b">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border:2px solid #16181b;border-radius:4px">
      <tr><td style="padding:24px">
        <p style="margin:0 0 8px;font-weight:700;color:#1f4fa3;letter-spacing:.04em">CUADROCORROCALLE</p>
        <h1 style="margin:0 0 16px;font-size:24px">${escape(title)}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.5">${intro}</p>
        <p style="margin:0 0 24px"><a href="${escape(url)}" style="display:inline-block;padding:12px 20px;background:#1f4fa3;color:#fff;font-weight:700;text-decoration:none;border-radius:4px">${escape(action)}</a></p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#4e555e">${outro}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function verifyEmailMessage(user: Recipient, url: string): Email {
  const hello = `Hola, ${user.name.split(' ')[0]}:`;
  const outro = 'Si no has creado una cuenta en CuadroCorroCalle, ignora este correo.';

  return {
    to: { email: user.email, name: user.name },
    subject: 'Confirma tu correo en CuadroCorroCalle',
    html: layout(
      'Confirma tu correo',
      `${escape(hello)} pulsa el botón para confirmar que este correo es tuyo.`,
      'Confirmar correo',
      url,
      outro,
    ),
    text: `${hello}\n\nConfirma tu correo abriendo este enlace:\n${url}\n\n${outro}`,
  };
}

export function resetPasswordMessage(user: Recipient, url: string): Email {
  const hello = `Hola, ${user.name.split(' ')[0]}:`;
  const outro =
    'El enlace caduca en 1 hora y solo sirve una vez. Si no has pedido cambiar la contraseña, ignora este correo: la tuya sigue igual.';

  return {
    to: { email: user.email, name: user.name },
    subject: 'Cambia tu contraseña de CuadroCorroCalle',
    html: layout(
      'Cambia tu contraseña',
      `${escape(hello)} pulsa el botón para elegir una contraseña nueva.`,
      'Cambiar contraseña',
      url,
      escape(outro),
    ),
    text: `${hello}\n\nElige una contraseña nueva abriendo este enlace:\n${url}\n\n${outro}`,
  };
}

/** Sent to the new address when someone changes their account's email (step 1.14). */
export function changeEmailMessage(user: Recipient, url: string): Email {
  const hello = `Hola, ${user.name.split(' ')[0]}:`;
  const outro =
    'Hasta que lo confirmes, tu cuenta sigue con el correo anterior. Si no has pedido este cambio, ignora este correo.';

  return {
    to: { email: user.email, name: user.name },
    subject: 'Confirma tu nuevo correo en CuadroCorroCalle',
    html: layout(
      'Confirma tu nuevo correo',
      `${escape(hello)} pulsa el botón para usar este correo en tu cuenta de CuadroCorroCalle.`,
      'Confirmar nuevo correo',
      url,
      escape(outro),
    ),
    text: `${hello}\n\nConfirma tu nuevo correo abriendo este enlace:\n${url}\n\n${outro}`,
  };
}
