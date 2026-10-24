use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::error::AppError;

pub fn derive_key(secret: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

pub fn generate_token(byte_count: usize) -> String {
    let mut bytes = vec![0u8; byte_count];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(&bytes)
}

pub fn encrypt(plaintext: &str, key: &[u8; 32]) -> Result<String, AppError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| AppError::Internal(format!("Failed to initialize cipher: {e}")))?;

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| AppError::Internal(format!("Encryption error: {e}")))?;

    // Combine nonce (12 bytes) + ciphertext
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(URL_SAFE_NO_PAD.encode(&combined))
}

pub fn decrypt(encoded: &str, key: &[u8; 32]) -> Result<String, AppError> {
    let combined = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|e| AppError::Internal(format!("Base64 decoding error: {e}")))?;

    if combined.len() < 12 {
        return Err(AppError::Internal(
            "Encrypted payload too short".to_string(),
        ));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| AppError::Internal(format!("Failed to initialize cipher: {e}")))?;

    let decrypted = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| AppError::Unauthorized("Failed to decrypt secure payload".to_string()))?;

    String::from_utf8(decrypted)
        .map_err(|e| AppError::Internal(format!("UTF-8 decoding error: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = derive_key("my-super-secret-password-1234");
        let token = "glpat-super-secret-access-token-987654";

        let encrypted = encrypt(token, &key).expect("encryption succeeds");
        assert_ne!(token, encrypted);

        let decrypted = decrypt(&encrypted, &key).expect("decryption succeeds");
        assert_eq!(token, decrypted);
    }
}
