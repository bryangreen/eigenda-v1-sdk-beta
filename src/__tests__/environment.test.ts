import { validateConfig } from '../utils/environment';

describe('environment', () => {
  describe('validateConfig', () => {
    it('should return empty array for valid config', () => {
      const config = {
        apiUrl: 'https://test.api.eigenda.xyz',
        rpcUrl: 'https://test.rpc.base.org',
        privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
        creditsContractAddress: '0x1234567890123456789012345678901234567890'
      };

      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should validate apiUrl format', () => {
      const config = {
        apiUrl: 'invalid-url'
      };

      const errors = validateConfig(config);
      expect(errors).toContain('Invalid API URL format');
    });

    it('should validate rpcUrl format', () => {
      const config = {
        rpcUrl: 'invalid-url'
      };

      const errors = validateConfig(config);
      expect(errors).toContain('Invalid RPC URL format');
    });

    it('should validate privateKey format', () => {
      const config = {
        privateKey: 'invalid-key'
      };

      const errors = validateConfig(config);
      expect(errors).toContain('Invalid private key format');
    });

    it('should validate creditsContractAddress format', () => {
      const config = {
        creditsContractAddress: 'invalid-address'
      };

      const errors = validateConfig(config);
      expect(errors).toContain('Invalid credits contract address format');
    });

    it('should accept privateKey with 0x prefix', () => {
      const config = {
        privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234'
      };

      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should accept privateKey without 0x prefix', () => {
      const config = {
        privateKey: '1234567890123456789012345678901234567890123456789012345678901234'
      };

      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });
  });
}); 