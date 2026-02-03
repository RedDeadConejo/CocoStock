/**
 * Script para sincronizar la versión entre package.json y src/constants/version.js
 * 
 * Uso:
 *   node scripts/sync-version.js [version]
 * 
 * Si no se proporciona versión, lee desde package.json y actualiza version.js
 * Si se proporciona versión, actualiza ambos archivos
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function readJsonFile(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error al leer ${path}:`, error.message);
    process.exit(1);
  }
}

function writeJsonFile(path, data) {
  try {
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  } catch (error) {
    console.error(`Error al escribir ${path}:`, error.message);
    process.exit(1);
  }
}

function readVersionFile() {
  try {
    const content = readFileSync(join(rootDir, 'src/constants/version.js'), 'utf-8');
    const match = content.match(/export const APP_VERSION = ['"]([^'"]+)['"]/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Error al leer src/constants/version.js:', error.message);
    return null;
  }
}

function writeVersionFile(version) {
  try {
    const filePath = join(rootDir, 'src/constants/version.js');
    let content = readFileSync(filePath, 'utf-8');
    content = content.replace(
      /export const APP_VERSION = ['"][^'"]+['"]/,
      `export const APP_VERSION = '${version}'`
    );
    writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    console.error('Error al escribir src/constants/version.js:', error.message);
    process.exit(1);
  }
}

// Validar formato de versión semántica
function isValidVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

// Función principal
function main() {
  const packageJsonPath = join(rootDir, 'package.json');
  const versionJsPath = join(rootDir, 'src/constants/version.js');
  
  const packageJson = readJsonFile(packageJsonPath);
  const currentPackageVersion = packageJson.version;
  const currentAppVersion = readVersionFile();

  const newVersion = process.argv[2];

  if (newVersion) {
    // Actualizar a una versión específica
    if (!isValidVersion(newVersion)) {
      console.error('Error: La versión debe seguir el formato semántico (ej: 1.0.0)');
      process.exit(1);
    }

    console.log(`Actualizando versión a ${newVersion}...`);
    
    // Actualizar package.json
    packageJson.version = newVersion;
    writeJsonFile(packageJsonPath, packageJson);
    console.log(`✓ package.json actualizado a ${newVersion}`);
    
    // Actualizar version.js
    writeVersionFile(newVersion);
    console.log(`✓ src/constants/version.js actualizado a ${newVersion}`);
    
    console.log('\n✓ Versión sincronizada correctamente');
  } else {
    // Sincronizar desde package.json a version.js
    if (!isValidVersion(currentPackageVersion)) {
      console.error(`Error: La versión en package.json (${currentPackageVersion}) no es válida`);
      process.exit(1);
    }

    if (currentPackageVersion !== currentAppVersion) {
      console.log(`Sincronizando versión...`);
      console.log(`  package.json: ${currentPackageVersion}`);
      console.log(`  version.js: ${currentAppVersion || 'no encontrada'}`);
      
      writeVersionFile(currentPackageVersion);
      console.log(`\n✓ src/constants/version.js actualizado a ${currentPackageVersion}`);
    } else {
      console.log(`✓ Las versiones ya están sincronizadas: ${currentPackageVersion}`);
    }
  }
}

main();

