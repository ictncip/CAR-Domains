const dompurifyPattern = /[\\/]node_modules[\\/]dompurify[\\/]/;

function matchesExclude(exclude, resourcePath) {
  if (!exclude) {
    return false;
  }

  if (typeof exclude === 'function') {
    return exclude(resourcePath);
  }

  if (Array.isArray(exclude)) {
    return exclude.some((entry) => matchesExclude(entry, resourcePath));
  }

  if (exclude instanceof RegExp) {
    return exclude.test(resourcePath);
  }

  return resourcePath.includes(String(exclude));
}

function visitRules(rules, visitor) {
  for (const rule of rules ?? []) {
    if (!rule) {
      continue;
    }

    visitor(rule);

    if (Array.isArray(rule.rules)) {
      visitRules(rule.rules, visitor);
    }

    if (Array.isArray(rule.oneOf)) {
      visitRules(rule.oneOf, visitor);
    }
  }
}

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      visitRules(webpackConfig.module?.rules, (rule) => {
        if (!rule.loader || !String(rule.loader).includes('source-map-loader')) {
          return;
        }

        const existingExclude = rule.exclude;
        rule.exclude = (resourcePath) =>
          dompurifyPattern.test(resourcePath) ||
          matchesExclude(existingExclude, resourcePath);
      });

      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings ?? []),
        (warning) => {
          const resource = warning?.module?.resource ?? '';
          const details = warning?.details ?? '';

          return (
            dompurifyPattern.test(resource) &&
            typeof details === 'string' &&
            details.includes('source-map-loader')
          );
        },
      ];

      return webpackConfig;
    },
  },
};
