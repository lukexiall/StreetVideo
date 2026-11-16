// Multilevel parametric AFT with right censoring and two crossed random intercepts
// log T = X beta + b_seg + u_sess + sigma * eps
// dist: 0 = log-normal, 1 = Weibull (min extreme value eps), 2 = log-logistic
#include <TMB.hpp>
template<class Type>
Type objective_function<Type>::operator() ()
{
  DATA_VECTOR(logt);
  DATA_VECTOR(event);
  DATA_MATRIX(X);
  DATA_IVECTOR(seg);
  DATA_IVECTOR(ses);
  DATA_INTEGER(dist);
  DATA_INTEGER(use_ses);
  PARAMETER_VECTOR(beta);
  PARAMETER(log_sigma);
  PARAMETER(log_sd_seg);
  PARAMETER(log_sd_ses);
  PARAMETER_VECTOR(b);
  PARAMETER_VECTOR(u);
  Type sigma = exp(log_sigma);
  Type nll = 0;
  nll -= sum(dnorm(b, Type(0), exp(log_sd_seg), true));
  if (use_ses) nll -= sum(dnorm(u, Type(0), exp(log_sd_ses), true));
  vector<Type> eta = X * beta;
  for (int i = 0; i < logt.size(); i++) {
    Type e = eta(i) + b(seg(i));
    if (use_ses) e += u(ses(i));
    Type z = (logt(i) - e) / sigma;
    Type lf, lS;
    if (dist == 0) {
      lf = dnorm(z, Type(0), Type(1), true);
      lS = log(pnorm(-z));
    } else if (dist == 1) {
      lf = z - exp(z);
      lS = -exp(z);
    } else {
      lf = z - 2 * logspace_add(Type(0), z);
      lS = -logspace_add(Type(0), z);
    }
    nll -= event(i) * (lf - log(sigma) - logt(i)) + (1 - event(i)) * lS;
  }
  ADREPORT(sigma);
  return nll;
}
