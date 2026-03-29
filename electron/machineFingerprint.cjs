/**
 * Huella estable del equipo para ligar la sesión guardada a un solo PC.
 * Windows: MachineGuid del registro (mismo criterio que muchas licencias).
 * Otros: hostname + MAC principal + plataforma.
 */
const os = require('os');
const { createHash } = require('crypto');
const { execSync } = require('child_process');

function tryWindowsMachineGuid() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { encoding: 'utf8', windowsHide: true, timeout: 8000 }
    );
    const m = /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(out);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function getPrimaryMac() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      const fam = iface.family;
      const v4 = fam === 'IPv4' || fam === 4;
      if (v4 && !iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac;
      }
    }
  }
  return '';
}

function getMachineFingerprint() {
  const guid = tryWindowsMachineGuid();
  const parts = guid
    ? ['win', guid]
    : ['fallback', os.hostname(), os.platform(), os.arch(), getPrimaryMac()];
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex');
}

module.exports = { getMachineFingerprint };
