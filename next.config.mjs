/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Excluir módulos de Node.js del bundle del cliente
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
      
      // Ignorar módulos que usan node: protocol
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^node:/,
        })
      );
    }
    
    // Excluir jsonwebtoken y bcryptjs del bundle del cliente
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'jsonwebtoken': 'commonjs jsonwebtoken',
        'bcryptjs': 'commonjs bcryptjs',
      });
    }
    
    return config;
  },
};

export default nextConfig;
